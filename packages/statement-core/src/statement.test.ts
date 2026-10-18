import { describe, expect, it } from "vitest";
import {
  type CsvUploadType,
  detectDateFormat,
  detectDelimiter,
  guessMapping,
  parseAmount,
  parseCsv,
  parseDate,
  processCsv,
  validateUploadType,
  windowRows,
} from "./index.js";

const base: Omit<CsvUploadType, "id"> = {
  name: "Test",
  format: "csv",
  delimiter: ",",
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "DD MM YYYY",
  amount: { kind: "single", column: 2 },
  decimalSeparator: ".",
  payeeColumn: 1,
};

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const rows = parseCsv('\uFEFFa,"b,1","c ""q"""\r\n\r\nx,y,z\n');
    expect(rows).toEqual([
      ["a", "b,1", 'c "q"'],
      ["x", "y", "z"],
    ]);
  });
  it("detects delimiters", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a\tb")).toBe("\t");
  });
});

describe("parsers", () => {
  it("parses dates", () => {
    expect(parseDate("05/03/2024", "DD MM YYYY")).toBe("2024-03-05");
    expect(parseDate("03/05/2024", "MM DD YYYY")).toBe("2024-03-05");
    expect(parseDate("31/02/2024", "DD MM YYYY")).toBeNull();
    expect(parseDate("nope", "YYYY MM DD")).toBeNull();
    expect(parseDate("2024-1-5", "YYYY MM DD")).toBe("2024-01-05");
    expect(parseDate("20240105", "YYYY MM DD")).toBe("2024-01-05");
    expect(parseDate("05.03.24", "DD MM YY")).toBe("2024-03-05");
    expect(parseDate("Mar 5, 2024", "MM DD YYYY")).toBe("2024-03-05");
    expect(parseDate("05/03/24", "DD MM YYYY")).toBeNull();
    expect(detectDateFormat("2024-01-05")).toBe("YYYY MM DD");
    expect(detectDateFormat("05/03/2024")).toBe("MM DD YYYY");
    expect(detectDateFormat("31/03/2024")).toBe("DD MM YYYY");
  });
  it("parses amounts", () => {
    expect(parseAmount("-1,234.56", ".")).toBe(-123456);
    expect(parseAmount("$12.30", ".")).toBe(1230);
    expect(parseAmount("(5.00)", ".")).toBe(-500);
    expect(parseAmount("1.234,56", ",")).toBe(123456);
    expect(parseAmount("-12,5", ",")).toBe(-1250);
    expect(parseAmount("", ".")).toBeNull();
    expect(parseAmount("abc", ".")).toBeNull();
  });
});

describe("validateUploadType", () => {
  it("accepts a complete type", () => {
    expect(validateUploadType(base)).toEqual([]);
  });
  it("requires name, date and amount", () => {
    const errs = validateUploadType({
      ...base,
      name: " ",
      dateColumn: undefined,
      amount: undefined,
    });
    expect(errs).toEqual(
      expect.arrayContaining([
        "Name is required",
        "Date column is required",
        "Amount column is required",
      ]),
    );
  });
});

describe("processCsv", () => {
  const csv =
    "Date,Desc,Amt\n05/03/2024,Coffee,-4.50\nbad,X,1\n06/03/2024,Pay,100\n";
  it("skips header, maps rows and reports errors", () => {
    const r = processCsv({ ...base, id: "1" }, csv, "acct");
    expect(r.transactions).toEqual([
      {
        account: "acct",
        date: "2024-03-05",
        amount: -450,
        payee_name: "Coffee",
        imported_payee: "Coffee",
      },
      {
        account: "acct",
        date: "2024-03-06",
        amount: 10000,
        payee_name: "Pay",
        imported_payee: "Pay",
      },
    ]);
    expect(r.errors).toEqual([{ row: 3, message: 'Invalid date "bad"' }]);
  });
  it("supports debit/credit columns and no header", () => {
    const r = processCsv(
      {
        ...base,
        id: "1",
        hasHeader: false,
        amount: { kind: "split", debitColumn: 2, creditColumn: 3 },
      },
      "05/03/2024,A,4.50,\n06/03/2024,B,,10\n",
      "acct",
    );
    expect(r.transactions.map((t) => t.amount)).toEqual([-450, 1000]);
  });
});

describe("amount options and skipped lines", () => {
  const t: CsvUploadType = { ...base, id: "1", hasHeader: false };
  it("supports an in/out column", () => {
    const r = processCsv(
      {
        ...t,
        amount: { kind: "inOut", column: 2, inOutColumn: 3, outValue: "Debit" },
      },
      "05/03/2024,A,4.50,Debit\n06/03/2024,B,10,Credit\n",
      "a",
    );
    expect(r.transactions.map((x) => x.amount)).toEqual([-450, 1000]);
  });
  it("flips amounts", () => {
    const r = processCsv(
      { ...t, flipAmount: true },
      "05/03/2024,A,4.50\n",
      "a",
    );
    expect(r.transactions[0]?.amount).toBe(-450);
  });
  it("skips start/end lines and reports file row numbers", () => {
    const text = "Account 123\nDate,D,A\n05/03/2024,A,1\nbad,B,2\nTotal,,3\n";
    const r = processCsv(
      { ...t, hasHeader: true, skipStartLines: 1, skipEndLines: 1 },
      text,
      "a",
    );
    expect(r.transactions).toHaveLength(1);
    expect(r.errors).toEqual([{ row: 4, message: 'Invalid date "bad"' }]);
    expect(windowRows({ hasHeader: false }, [["a"]]).data).toEqual([["a"]]);
  });
  it("validates in/out and skip values", () => {
    const errs = validateUploadType({
      ...base,
      amount: { kind: "inOut", column: 1 },
      skipStartLines: -1,
    });
    expect(errs).toEqual(
      expect.arrayContaining([
        "In/Out column is required",
        "Out value is required",
        "skipStartLines must be a non-negative integer",
      ]),
    );
  });
});

describe("guessMapping", () => {
  it("guesses from headers and detects format", () => {
    const g = guessMapping(
      windowRows(
        { hasHeader: true },
        parseCsv("Date,Description,Debit,Credit\n05/03/2024,Coffee,4,50,\n"),
      ),
    );
    expect(g.assignments).toMatchObject({ 0: "date", 1: "payee" });
    expect(g.dateFormat).toBe("MM DD YYYY");
  });
  it("guesses split + decimal comma", () => {
    const g = guessMapping(
      windowRows(
        { hasHeader: true },
        parseCsv('Date,Payee,Debit,Credit\n2024-01-05,X,"4,50",\n'),
      ),
    );
    expect(g.amountKind).toBe("split");
    expect(g.assignments).toMatchObject({ 2: "debit", 3: "credit" });
    expect(g.decimalSeparator).toBe(",");
    expect(g.dateFormat).toBe("YYYY MM DD");
  });
  it("falls back to value shapes without a header", () => {
    const g = guessMapping(
      windowRows({ hasHeader: false }, parseCsv("2024-01-05,Coffee,-4.50\n")),
    );
    expect(g.assignments).toEqual({ 0: "date", 2: "amount" });
  });
});

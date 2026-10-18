import { describe, expect, it } from "vitest";
import {
  type CsvUploadType,
  detectDelimiter,
  parseAmount,
  parseCsv,
  parseDate,
  processCsv,
  validateUploadType,
} from "./index.js";

const base: Omit<CsvUploadType, "id"> = {
  name: "Test",
  format: "csv",
  delimiter: ",",
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "DD/MM/YYYY",
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
    expect(parseDate("05/03/2024", "DD/MM/YYYY")).toBe("2024-03-05");
    expect(parseDate("03/05/2024", "MM/DD/YYYY")).toBe("2024-03-05");
    expect(parseDate("31/02/2024", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("nope", "YYYY-MM-DD")).toBeNull();
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

import { describe, expect, it } from "vitest";
import {
  type CsvSource,
  interpretRow,
  parseMonthDay,
  processCsv,
  resolveYears,
  validateSource,
} from "./index.js";
import { guessAlignedConfig } from "./pdf/alignedColumns.js";
import { FIXTURE_PAGES } from "./pdf/fixture.js";

const csv: Omit<CsvSource, "id"> = {
  name: "Test",
  format: "csv",
  delimiter: ",",
  hasHeader: false,
  dateColumn: 0,
  dateFormat: "YYYY MM DD",
  amount: { kind: "single", column: 1 },
  decimalSeparator: ",",
  creditMarker: "CR",
};
const amountOf = (cell: string, over: Partial<CsvSource> = {}) =>
  interpretRow({ ...csv, ...over } as CsvSource, ["2024-01-02", cell]).amount;

describe("credit marker", () => {
  it("makes marked amounts inflows and others outflows", () => {
    expect(amountOf("113,83CR")).toBe(11383);
    expect(amountOf("59,00")).toBe(-5900);
    expect(amountOf("-59,00")).toBe(-5900);
    expect(amountOf("113,83cr")).toBe(11383);
  });
  it("handles thousands separators", () => {
    expect(amountOf("1 979,73CR")).toBe(197973);
  });
  it("applies flip after the marker", () => {
    expect(amountOf("113,83CR", { flipAmount: true })).toBe(-11383);
  });
  it("leaves parsing unchanged without a marker", () => {
    expect(amountOf("-59,00", { creditMarker: undefined })).toBe(-5900);
    expect(amountOf("113,83CR", { creditMarker: undefined })).toBe(11383);
  });
  it("is used when processing CSV", () => {
    const r = processCsv(csv as CsvSource, "2024-01-02,113.83CR\n", "a");
    expect(r.warnings).toEqual([]);
  });
  it("rejects invalid markers", () => {
    expect(validateSource({ ...csv, creditMarker: "12" })).not.toEqual([]);
    expect(validateSource({ ...csv, creditMarker: "" })).not.toEqual([]);
    expect(validateSource({ ...csv, creditMarker: "CR" })).toEqual([]);
  });
});

describe("year-less dates", () => {
  it("parses day and month in either order", () => {
    expect(parseMonthDay("03 09", "DD MM")).toEqual({ month: 9, day: 3 });
    expect(parseMonthDay("03/09", "MM DD")).toEqual({ month: 3, day: 9 });
    expect(parseMonthDay("3-sep", "DD MM")).toEqual({ month: 9, day: 3 });
    expect(parseMonthDay("Sep 3", "MM DD")).toEqual({ month: 9, day: 3 });
    expect(parseMonthDay("29 02", "DD MM")).toEqual({ month: 2, day: 29 });
  });
  it("rejects invalid values", () => {
    expect(parseMonthDay("32 01", "DD MM")).toBeNull();
    expect(parseMonthDay("13 13", "DD MM")).toBeNull();
    expect(parseMonthDay("31 04", "DD MM")).toBeNull();
    expect(parseMonthDay("12,50", "DD MM")).toBeNull();
    expect(parseMonthDay("2026-09-03", "DD MM")).toBeNull();
    expect(parseMonthDay("", "DD MM")).toBeNull();
  });
  it("is not a CSV date format", () => {
    expect(validateSource({ ...csv, dateFormat: "DD MM" })).not.toEqual([]);
  });
});

describe("resolveYears", () => {
  const md = (month: number, day: number) => ({ month, day });
  it("steps back across a year boundary", () => {
    expect(resolveYears([md(12, 28), md(1, 3)], 2026)).toEqual([2025, 2026]);
  });
  it("ignores small backward steps", () => {
    expect(resolveYears([md(10, 2), md(9, 30), md(10, 1)], 2026)).toEqual([
      2026, 2026, 2026,
    ]);
  });
  it("skips unparseable rows", () => {
    expect(resolveYears([md(12, 1), null, md(1, 2)], 2026)).toEqual([
      2025,
      null,
      2026,
    ]);
  });
});

describe("PDF sources", () => {
  const config = guessAlignedConfig(FIXTURE_PAGES);
  const source = {
    name: "Card",
    format: "pdf",
    approach: "aligned-columns",
    config: { ...config, yearAnchor: { page: 1, x: 50, y: 742 } },
  };
  it("accepts a valid source", () => {
    expect(validateSource(source)).toEqual([]);
  });
  it("rejects an unknown approach", () => {
    expect(validateSource({ ...source, approach: "magic" })).toEqual([
      'Unknown extraction approach "magic"',
    ]);
  });
  it("rejects an invalid config", () => {
    expect(validateSource({ ...source, config: { version: 1 } })).not.toEqual(
      [],
    );
  });
  it("leaves CSV sources untouched", () => {
    expect(validateSource(csv)).toEqual([]);
  });
});

import type { Transaction } from "crawler-core";
import { parseCsv } from "./csv.js";

/** Field order and year width; the separator in the file doesn't matter. */
export const DATE_FORMATS = [
  "YYYY MM DD",
  "YY MM DD",
  "MM DD YYYY",
  "MM DD YY",
  "DD MM YYYY",
  "DD MM YY",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export type AmountSource =
  | { kind: "single"; column: number }
  | { kind: "split"; debitColumn: number; creditColumn: number }
  /** One amount column plus a column saying whether it's money out. */
  | {
      kind: "inOut";
      column: number;
      inOutColumn: number;
      /** Value of the in/out column that marks an outflow (e.g. "Debit"). */
      outValue: string;
    };

/** Describes how to read one institution's CSV statements. */
export interface CsvSource {
  id: string;
  name: string;
  format: "csv";
  delimiter: string;
  /** Lines to ignore at the start of the file (before any header). */
  skipStartLines?: number;
  /** Lines to ignore at the end of the file. */
  skipEndLines?: number;
  /** Whether the first row (after skipped lines) is a header to ignore. */
  hasHeader: boolean;
  dateColumn: number;
  dateFormat: DateFormat;
  amount: AmountSource;
  decimalSeparator: "." | ",";
  /** Swap inflows and outflows. */
  flipAmount?: boolean;
  payeeColumn?: number;
  notesColumn?: number;
  importedIdColumn?: number;
}

/** Union so other formats (e.g. PDF) can be added later. */
export type Source = CsvSource;

export type SourceDraft = Omit<CsvSource, "id">;

const isIndex = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Returns human-readable problems; an empty array means the type is valid. */
export function validateSource(input: unknown): string[] {
  const errors: string[] = [];
  const t = (input ?? {}) as Partial<CsvSource>;
  if (typeof t.name !== "string" || t.name.trim() === "") {
    errors.push("Name is required");
  }
  if (t.format !== "csv") errors.push("Unsupported format");
  if (typeof t.delimiter !== "string" || t.delimiter.length !== 1) {
    errors.push("Delimiter must be a single character");
  }
  if (typeof t.hasHeader !== "boolean") errors.push("hasHeader is required");
  if (!isIndex(t.dateColumn)) errors.push("Date column is required");
  if (!DATE_FORMATS.includes(t.dateFormat as DateFormat)) {
    errors.push("Date format is required");
  }
  if (t.decimalSeparator !== "." && t.decimalSeparator !== ",") {
    errors.push("Decimal separator must be . or ,");
  }
  const a = t.amount;
  if (a?.kind === "single") {
    if (!isIndex(a.column)) errors.push("Amount column is required");
  } else if (a?.kind === "split") {
    if (!isIndex(a.debitColumn)) errors.push("Debit column is required");
    if (!isIndex(a.creditColumn)) errors.push("Credit column is required");
  } else if (a?.kind === "inOut") {
    if (!isIndex(a.column)) errors.push("Amount column is required");
    if (!isIndex(a.inOutColumn)) errors.push("In/Out column is required");
    if (typeof a.outValue !== "string" || a.outValue.trim() === "") {
      errors.push("Out value is required");
    }
  } else {
    errors.push("Amount column is required");
  }
  for (const key of ["skipStartLines", "skipEndLines"] as const) {
    const v = t[key];
    if (v !== undefined && !(Number.isInteger(v) && v >= 0)) {
      errors.push(`${key} must be a non-negative integer`);
    }
  }
  for (const key of [
    "payeeColumn",
    "notesColumn",
    "importedIdColumn",
  ] as const) {
    if (t[key] !== undefined && !isIndex(t[key])) {
      errors.push(`${key} must be a column index`);
    }
  }
  errors.push(...duplicateColumnErrors(t));
  return errors;
}

/** Reports every column that has been assigned to more than one field. */
function duplicateColumnErrors(t: Partial<CsvSource>): string[] {
  const a = t.amount;
  const uses: Array<[string, unknown]> = [
    ["Date", t.dateColumn],
    ["Payee", t.payeeColumn],
    ["Notes", t.notesColumn],
    ["Transaction ID", t.importedIdColumn],
  ];
  if (a?.kind === "single") uses.push(["Amount", a.column]);
  else if (a?.kind === "split") {
    uses.push(["Outflow", a.debitColumn], ["Inflow", a.creditColumn]);
  } else if (a?.kind === "inOut") {
    uses.push(["Amount", a.column], ["In/Out", a.inOutColumn]);
  }
  const byColumn = new Map<number, string[]>();
  for (const [label, column] of uses) {
    if (!isIndex(column)) continue;
    byColumn.set(column, [...(byColumn.get(column) ?? []), label]);
  }
  return [...byColumn.values()]
    .filter((labels) => labels.length > 1)
    .map((labels) => `${labels.join(" and ")} cannot use the same column`);
}

const MONTHS: Array<[RegExp, string]> = [
  [/\bjan(\.|uary)?\b/i, "01"],
  [/\bfeb(\.|ruary)?\b/i, "02"],
  [/\bmar(\.|ch)?\b/i, "03"],
  [/\bapr(\.|il)?\b/i, "04"],
  [/\bmay\.?\b/i, "05"],
  [/\bjun(\.|e)?\b/i, "06"],
  [/\bjul(\.|y)?\b/i, "07"],
  [/\baug(\.|ust)?\b/i, "08"],
  [/\bsep(\.|t\.?|tember)?\b/i, "09"],
  [/\boct(\.|ober)?\b/i, "10"],
  [/\bnov(\.|ember)?\b/i, "11"],
  [/\bdec(\.|ember)?\b/i, "12"],
];

/**
 * Converts a date string to `YYYY-MM-DD`, or null if it doesn't match.
 * Any separator is accepted, as are month names and unseparated digits
 * (e.g. `20240105`). Two-digit years are read as 20YY.
 */
export function parseDate(raw: string, format: DateFormat): string | null {
  let str = raw.trim();
  for (const [re, num] of MONTHS) str = str.replace(re, num);
  str = str.replace(/^\D+/, "").replace(/\D+$/, "");
  const [first, second, third] = format.split(" ") as [string, string, string];
  const widths: Record<string, number> = { YYYY: 4, YY: 2, MM: 2, DD: 2 };

  let parts = str.split(/\D+/);
  if (parts.length < 3) {
    const digits = str.replace(/\D/g, "");
    const w1 = widths[first] as number;
    const w2 = widths[second] as number;
    parts = [
      digits.slice(0, w1),
      digits.slice(w1, w1 + w2),
      digits.slice(w1 + w2),
    ];
  }
  const v: Record<string, string> = {};
  [first, second, third].forEach((tok, i) => {
    v[tok.startsWith("Y") ? "Y" : tok] = parts[i] ?? "";
  });
  const yearWidth = format.includes("YYYY") ? 4 : 2;
  if (v.Y?.length !== yearWidth) return null;
  if (!/^\d{1,2}$/.test(v.MM ?? "") || !/^\d{1,2}$/.test(v.DD ?? "")) {
    return null;
  }
  const y = yearWidth === 2 ? 2000 + Number(v.Y) : Number(v.Y);
  const m = Number(v.MM);
  const d = Number(v.DD);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Share of non-empty samples that must parse for a format to be considered. */
const MATCH_THRESHOLD = 0.8;

/**
 * Returns every date format that fits the samples best (in `DATE_FORMATS`
 * order). Looking at all samples, not just the first, resolves ambiguity: a
 * value like `31/03/2024` rules out `MM DD YYYY`. A few stray rows (such as a
 * footer) are tolerated. More than one result means the samples are ambiguous.
 */
export function detectDateFormats(samples: string[]): DateFormat[] {
  const values = samples.map((v) => v.trim()).filter((v) => v !== "");
  if (values.length === 0) return [];
  const scored = DATE_FORMATS.map((f) => ({
    f,
    n: values.filter((v) => parseDate(v, f) !== null).length,
  }));
  const best = Math.max(...scored.map((x) => x.n));
  if (best === 0 || best / values.length < MATCH_THRESHOLD) return [];
  return scored.filter((x) => x.n === best).map((x) => x.f);
}

/** Finds the first date format (in `DATE_FORMATS` order) that fits `sample`. */
export function detectDateFormat(sample: string | string[]): DateFormat | null {
  return (
    detectDateFormats(Array.isArray(sample) ? sample : [sample])[0] ?? null
  );
}

/**
 * Whether a string has the shape of a money amount ("-1,234.50", "$12",
 * "(5.00)", "12,50 $"). Dates such as "2024-01-05" are not amounts.
 */
export function looksLikeAmount(raw: string): boolean {
  return /^\(?[-+]?[^\d\s()+-]{0,3}\s*[-+]?\d[\d\s.,']*-?\)?\s*[^\d\s()+-]{0,3}$/.test(
    raw.trim(),
  );
}

/** Parses a money string to integer cents. Empty string yields null. */
export function parseAmount(
  raw: string,
  decimalSeparator: "." | ",",
): number | null {
  let s = raw.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[^\d.,]/g, "");
  s =
    decimalSeparator === "."
      ? s.replace(/,/g, "")
      : s.replace(/\./g, "").replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

export interface RowError {
  /** 1-based row number in the file (header included). */
  row: number;
  message: string;
}

export interface ProcessResult {
  transactions: Transaction[];
  errors: RowError[];
}

const cell = (row: string[], i: number | undefined): string =>
  i === undefined ? "" : (row[i] ?? "").trim();

export interface InterpretedRow {
  /** `YYYY-MM-DD`, or null if the date cell is empty/invalid. */
  date: string | null;
  /** Integer cents, or null if the amount cells are empty/invalid. */
  amount: number | null;
}

/** Reads just the date and amount of a row (used by previews and mapping). */
export function interpretRow(type: CsvSource, row: string[]): InterpretedRow {
  const date = parseDate(cell(row, type.dateColumn), type.dateFormat);
  const sep = type.decimalSeparator;
  const a = type.amount;
  let amount: number | null;
  if (a.kind === "single") {
    amount = parseAmount(cell(row, a.column), sep);
  } else if (a.kind === "split") {
    const debit = parseAmount(cell(row, a.debitColumn), sep);
    const credit = parseAmount(cell(row, a.creditColumn), sep);
    amount =
      debit === null && credit === null
        ? null
        : Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
  } else {
    const value = parseAmount(cell(row, a.column), sep);
    const isOut =
      cell(row, a.inOutColumn).toLowerCase() ===
      a.outValue.trim().toLowerCase();
    amount = value === null ? null : isOut ? -Math.abs(value) : Math.abs(value);
  }
  if (amount !== null && type.flipAmount) amount = -amount;
  return { date, amount };
}

/** Maps a single parsed row to a transaction, or an error message. */
export function mapRow(
  type: CsvSource,
  row: string[],
  account: string,
): Transaction | string {
  const { date, amount } = interpretRow(type, row);
  if (!date) return `Invalid date "${cell(row, type.dateColumn)}"`;
  if (amount === null) return "Invalid or missing amount";

  const tx: Transaction = { account, date, amount };
  const payee = cell(row, type.payeeColumn);
  if (payee) {
    tx.payee_name = payee;
    tx.imported_payee = payee;
  }
  const notes = cell(row, type.notesColumn);
  if (notes) tx.notes = notes;
  const importedId = cell(row, type.importedIdColumn);
  if (importedId) tx.imported_id = importedId;
  return tx;
}

export interface RowWindow {
  header?: string[];
  data: string[][];
  /** Number of rows before `data[0]` (for reporting row numbers). */
  offset: number;
}

/** Applies skipped lines and the header setting to parsed rows. */
export function windowRows(
  type: Pick<CsvSource, "hasHeader" | "skipStartLines" | "skipEndLines">,
  rows: string[][],
): RowWindow {
  const start = type.skipStartLines ?? 0;
  const end = type.skipEndLines ?? 0;
  let kept = rows.slice(start, end > 0 ? rows.length - end : undefined);
  let offset = start;
  let header: string[] | undefined;
  if (type.hasHeader && kept.length > 0) {
    header = kept[0];
    kept = kept.slice(1);
    offset += 1;
  }
  return { header, data: kept, offset };
}

/** Processes CSV text into transactions using a source. */
export function processCsv(
  type: CsvSource,
  text: string,
  account: string,
): ProcessResult {
  const { data, offset } = windowRows(type, parseCsv(text, type.delimiter));
  const transactions: Transaction[] = [];
  const errors: RowError[] = [];
  data.forEach((row, i) => {
    const result = mapRow(type, row, account);
    if (typeof result === "string") {
      errors.push({ row: offset + i + 1, message: result });
    } else {
      transactions.push(result);
    }
  });
  return { transactions, errors };
}

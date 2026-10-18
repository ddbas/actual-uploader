import type { Transaction } from "crawler-core";
import { parseCsv } from "./csv.js";

export const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD-MM-YYYY",
  "MM-DD-YYYY",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export type AmountSource =
  | { kind: "single"; column: number }
  | { kind: "split"; debitColumn: number; creditColumn: number };

/** Describes how to read one institution's CSV statements. */
export interface CsvUploadType {
  id: string;
  name: string;
  format: "csv";
  delimiter: string;
  /** Whether the first row is a header to ignore. */
  hasHeader: boolean;
  dateColumn: number;
  dateFormat: DateFormat;
  amount: AmountSource;
  decimalSeparator: "." | ",";
  payeeColumn?: number;
  notesColumn?: number;
  importedIdColumn?: number;
}

/** Union so other formats (e.g. PDF) can be added later. */
export type UploadType = CsvUploadType;

export type UploadTypeDraft = Omit<CsvUploadType, "id">;

const isIndex = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Returns human-readable problems; an empty array means the type is valid. */
export function validateUploadType(input: unknown): string[] {
  const errors: string[] = [];
  const t = (input ?? {}) as Partial<CsvUploadType>;
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
  } else {
    errors.push("Amount column is required");
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
  return errors;
}

/** Converts a date string to `YYYY-MM-DD`, or null if it doesn't match. */
export function parseDate(raw: string, format: DateFormat): string | null {
  const parts = raw.trim().split(/[-/]/);
  const tokens = format.split(/[-/]/);
  if (parts.length !== 3) return null;
  const v: Record<string, string> = {};
  tokens.forEach((tok, i) => {
    v[tok] = parts[i] as string;
  });
  const [y, m, d] = [v.YYYY, v.MM, v.DD].map((s) => Number(s));
  if (!/^\d{4}$/.test(v.YYYY ?? "") || !/^\d{1,2}$/.test(v.MM ?? ""))
    return null;
  if (!/^\d{1,2}$/.test(v.DD ?? "")) return null;
  const date = new Date(Date.UTC(y as number, (m as number) - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== (m as number) - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m as number)}-${pad(d as number)}`;
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

/** Maps a single parsed row to a transaction, or an error message. */
export function mapRow(
  type: CsvUploadType,
  row: string[],
  account: string,
): Transaction | string {
  const date = parseDate(cell(row, type.dateColumn), type.dateFormat);
  if (!date) return `Invalid date "${cell(row, type.dateColumn)}"`;

  let amount: number;
  if (type.amount.kind === "single") {
    const a = parseAmount(cell(row, type.amount.column), type.decimalSeparator);
    if (a === null) return `Invalid amount "${cell(row, type.amount.column)}"`;
    amount = a;
  } else {
    const debit = parseAmount(
      cell(row, type.amount.debitColumn),
      type.decimalSeparator,
    );
    const credit = parseAmount(
      cell(row, type.amount.creditColumn),
      type.decimalSeparator,
    );
    if (debit === null && credit === null) return "Missing debit and credit";
    amount = Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
  }

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

/** Processes CSV text into transactions using an upload type. */
export function processCsv(
  type: CsvUploadType,
  text: string,
  account: string,
): ProcessResult {
  const rows = parseCsv(text, type.delimiter);
  const transactions: Transaction[] = [];
  const errors: RowError[] = [];
  rows.forEach((row, i) => {
    if (i === 0 && type.hasHeader) return;
    const result = mapRow(type, row, account);
    if (typeof result === "string")
      errors.push({ row: i + 1, message: result });
    else transactions.push(result);
  });
  return { transactions, errors };
}

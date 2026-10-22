import type { Transaction } from "./transaction.js";

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

/**
 * Formats with no year. They are only offered where the year can come from
 * elsewhere (PDF sources) and are resolved with `resolveYears`.
 */
export const YEARLESS_DATE_FORMATS = ["DD MM", "MM DD"] as const;
export type YearlessDateFormat = (typeof YEARLESS_DATE_FORMATS)[number];

export const isYearlessFormat = (f: string): f is YearlessDateFormat =>
  (YEARLESS_DATE_FORMATS as readonly string[]).includes(f);

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

/** How to read the fields of a transaction from a row of cells. */
export interface FieldMapping {
  dateColumn: number;
  dateFormat: DateFormat | YearlessDateFormat;
  amount: AmountSource;
  decimalSeparator: "." | ",";
  /** Swap inflows and outflows. */
  flipAmount?: boolean;
  /**
   * Single amount layout only: text (e.g. "CR") that marks an inflow when the
   * amount ends with it. Amounts without it are outflows.
   */
  creditMarker?: string;
  payeeColumn?: number;
  notesColumn?: number;
  importedIdColumn?: number;
}

export const isIndex = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Validates the fields of a mapping; `allowYearless` for PDF sources. */
export function validateMapping(
  t: Partial<FieldMapping>,
  allowYearless: boolean,
): string[] {
  const errors: string[] = [];
  if (!isIndex(t.dateColumn)) errors.push("Date column is required");
  const formats: readonly string[] = allowYearless
    ? [...DATE_FORMATS, ...YEARLESS_DATE_FORMATS]
    : DATE_FORMATS;
  if (!formats.includes(t.dateFormat as string)) {
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
  if (t.creditMarker !== undefined) {
    if (
      typeof t.creditMarker !== "string" ||
      /^[\d\s.,'+-]*$/.test(t.creditMarker)
    ) {
      errors.push("Credit marker must be text, not digits or separators");
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
function duplicateColumnErrors(t: Partial<FieldMapping>): string[] {
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
  const str = replaceMonthNames(raw.trim());
  return parseNumericDate(str, format);
}

function replaceMonthNames(raw: string): string {
  let str = raw;
  for (const [re, num] of MONTHS) str = str.replace(re, num);
  return str;
}

function parseNumericDate(input: string, format: DateFormat): string | null {
  const str = input.replace(/^\D+/, "").replace(/\D+$/, "");
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

export interface MonthDay {
  month: number;
  day: number;
}

/**
 * Reads a date that has only a day and a month ("03 09", "9/3", "03-sep",
 * "Sep 3"). Digits must be separated by whitespace, "/" or "-" (not "," or
 * ".", which would match amounts such as "12,50"). February 29 is accepted.
 */
export function parseMonthDay(
  raw: string,
  format: YearlessDateFormat,
): MonthDay | null {
  const str = replaceMonthNames(raw.trim())
    .replace(/^[^\d]+/, "")
    .replace(/[^\d]+$/, "");
  const parts = str.split(/[\s/\\-]+/);
  if (parts.length !== 2 || parts.some((p) => !/^\d{1,2}$/.test(p))) {
    return null;
  }
  const [a, b] = parts.map(Number) as [number, number];
  const month = format === "DD MM" ? b : a;
  const day = format === "DD MM" ? a : b;
  const date = new Date(Date.UTC(2000, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { month, day };
}

/**
 * Gives each month/day a year. `anchorYear` is the year of the last parseable
 * row; going backwards the year steps back whenever the month jumps upward by
 * more than six (a real year boundary jumps by eleven, while slightly out of
 * order rows jump by one or two). Unparseable rows (null) are skipped.
 */
export function resolveYears(
  rows: Array<MonthDay | null>,
  anchorYear: number,
): Array<number | null> {
  const years: Array<number | null> = rows.map(() => null);
  let year = anchorYear;
  let later: number | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const md = rows[i];
    if (!md) continue;
    if (later !== null && md.month - later > 6) year -= 1;
    years[i] = year;
    later = md.month;
  }
  return years;
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

/** Like `detectDateFormats`, for the year-less formats. */
export function detectYearlessFormats(samples: string[]): YearlessDateFormat[] {
  const values = samples.map((v) => v.trim()).filter((v) => v !== "");
  if (values.length === 0) return [];
  const scored = YEARLESS_DATE_FORMATS.map((f) => ({
    f,
    n: values.filter((v) => parseMonthDay(v, f) !== null).length,
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
  /** 1-based row number in the file (header included), or line on the page. */
  row: number;
  /** 1-based page number, for PDF sources. */
  page?: number;
  message: string;
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
export function interpretRow(
  type: FieldMapping,
  row: string[],
): InterpretedRow {
  // Year-less formats need a year from elsewhere; the caller supplies a full
  // date in the cell (see the Aligned columns approach).
  const date = isYearlessFormat(type.dateFormat)
    ? null
    : parseDate(cell(row, type.dateColumn), type.dateFormat);
  const sep = type.decimalSeparator;
  const a = type.amount;
  let amount: number | null;
  if (a.kind === "single") {
    const raw = cell(row, a.column);
    const marker = type.creditMarker?.trim().toLowerCase();
    if (marker) {
      const isCredit = raw.toLowerCase().endsWith(marker);
      const value = parseAmount(
        isCredit ? raw.slice(0, raw.length - marker.length) : raw,
        sep,
      );
      amount =
        value === null ? null : isCredit ? Math.abs(value) : -Math.abs(value);
    } else {
      amount = parseAmount(raw, sep);
    }
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
  type: FieldMapping,
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

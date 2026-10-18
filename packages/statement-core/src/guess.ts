import { analyzeColumns } from "./columns.js";
import {
  type DateFormat,
  detectDateFormats,
  type RowWindow,
} from "./uploadType.js";

export type FieldKey =
  | "date"
  | "amount"
  | "debit"
  | "credit"
  | "inOut"
  | "payee"
  | "notes"
  | "importedId";

export interface MappingGuess {
  assignments: Record<number, FieldKey>;
  amountKind: "single" | "split";
  dateFormat: DateFormat;
  decimalSeparator: "." | ",";
}

const HEADER_PATTERNS: Array<[FieldKey, RegExp]> = [
  ["date", /date/i],
  ["debit", /debit|débit|withdraw|outflow|retrait/i],
  ["credit", /credit|crédit|deposit|dépôt|depot|inflow/i],
  ["amount", /amount|montant/i],
  ["payee", /payee|description|merchant|libell|name/i],
  ["notes", /memo|notes?|details?/i],
  ["importedId", /\b(id|ref|reference)\b|transaction (id|number)/i],
];

/**
 * Guesses which column is which from header names (when present) and the
 * shape of the first data row, mirroring Actual Budget's importer.
 */
export function guessMapping(window: RowWindow): MappingGuess {
  const { header, data } = window;
  const assignments: Record<number, FieldKey> = {};
  const used = new Set<number>();
  const take = (field: FieldKey, index: number | undefined) => {
    if (index === undefined || index < 0 || used.has(index)) return;
    assignments[index] = field;
    used.add(index);
  };

  if (header) {
    for (const [field, re] of HEADER_PATTERNS) {
      take(
        field,
        header.findIndex((h, i) => !used.has(i) && re.test(h)),
      );
    }
  }

  const columnCount = Math.max(
    0,
    ...data.map((r) => r.length),
    header?.length ?? 0,
  );
  const info = analyzeColumns(data, columnCount);
  const has = (f: FieldKey) => Object.values(assignments).includes(f);
  const firstUnused = (pred: (c: (typeof info)[number]) => boolean) =>
    info.find((c) => !used.has(c.index) && pred(c))?.index;

  // Fall back to what the values look like across the sample rows.
  if (!has("date"))
    take(
      "date",
      firstUnused((c) => c.looksLikeDate),
    );
  if (!has("amount") && !(has("debit") && has("credit"))) {
    take(
      "amount",
      firstUnused((c) => c.looksLikeAmount && !c.looksLikeDate),
    );
  }

  const amountKind = has("debit") && has("credit") ? "split" : "single";
  if (amountKind === "split") {
    for (const [i, f] of Object.entries(assignments)) {
      if (f === "amount") delete assignments[Number(i)];
    }
  } else {
    for (const [i, f] of Object.entries(assignments)) {
      if (f === "debit" || f === "credit") delete assignments[Number(i)];
    }
  }

  const dateIndex = Object.entries(assignments).find(
    ([, f]) => f === "date",
  )?.[0];
  const dateValues =
    dateIndex === undefined ? [] : data.map((r) => r[Number(dateIndex)] ?? "");
  const dateFormat =
    detectDateFormats(dateValues)[0] ??
    (dateIndex === undefined ? "YYYY MM DD" : "MM DD YYYY");

  // European-style amounts use a decimal comma ("12,50").
  const amountCols = Object.entries(assignments)
    .filter(([, f]) => f === "amount" || f === "debit" || f === "credit")
    .map(([i]) => Number(i));
  const cells = data.flatMap((r) => amountCols.map((c) => (r[c] ?? "").trim()));
  const decimalSeparator =
    cells.some((v) => /,\d{1,2}$/.test(v)) &&
    !cells.some((v) => /\.\d{1,2}$/.test(v))
      ? ","
      : ".";

  return { assignments, amountKind, dateFormat, decimalSeparator };
}

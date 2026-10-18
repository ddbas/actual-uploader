import {
  type DateFormat,
  detectDateFormat,
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

  const sample = data[0] ?? [];
  const has = (f: FieldKey) => Object.values(assignments).includes(f);

  if (!has("date")) {
    take(
      "date",
      sample.findIndex(
        (v, i) => !used.has(i) && /^\d+[-/.]\d+[-/.]\d+$/.test(v.trim()),
      ),
    );
  }
  if (!has("amount") && !(has("debit") && has("credit"))) {
    take(
      "amount",
      sample.findIndex((v, i) => !used.has(i) && /^-?[.,\d]+$/.test(v.trim())),
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
  const dateSample =
    dateIndex === undefined ? undefined : data[0]?.[Number(dateIndex)];
  const dateFormat =
    (dateSample && detectDateFormat(dateSample)) ||
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

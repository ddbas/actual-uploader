import { detectDateFormats, looksLikeAmount } from "./uploadType.js";

export interface ColumnInfo {
  index: number;
  /** At least one row has a non-empty value in this column. */
  hasValues: boolean;
  /** First non-empty value, handy for labelling the column. */
  sample: string;
  /** Most non-empty values look like dates in a single format family. */
  looksLikeDate: boolean;
  /** Most non-empty values look like money amounts. */
  looksLikeAmount: boolean;
}

const MATCH_THRESHOLD = 0.8;
const MAX_ROWS = 200;

/** Inspects each column's values so the UI can offer only sensible ones. */
export function analyzeColumns(
  data: string[][],
  columnCount: number,
): ColumnInfo[] {
  const rows = data.slice(0, MAX_ROWS);
  return Array.from({ length: columnCount }, (_, index) => {
    const values = rows
      .map((r) => (r[index] ?? "").trim())
      .filter((v) => v !== "");
    const amounts = values.filter(looksLikeAmount).length;
    return {
      index,
      hasValues: values.length > 0,
      sample: values[0] ?? "",
      looksLikeDate: detectDateFormats(values).length > 0,
      looksLikeAmount:
        values.length > 0 && amounts / values.length >= MATCH_THRESHOLD,
    };
  });
}

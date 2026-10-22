import { parseCsv } from "./csv.js";
import {
  type FieldMapping,
  mapRow,
  type RowError,
  validateMapping,
} from "./mapping.js";
import { type ApproachId, getApproach } from "./pdf/registry.js";
import type { Transaction } from "./transaction.js";

/** Describes how to read one institution's CSV statements. */
export interface CsvSource extends FieldMapping {
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
}

/**
 * Describes how to read one institution's PDF statements: which extraction
 * approach to use, and that approach's (opaque, versioned) configuration.
 */
export interface PdfSource {
  id: string;
  name: string;
  format: "pdf";
  approach: ApproachId;
  config: unknown;
}

export type Source = CsvSource | PdfSource;

export type SourceDraft = Omit<CsvSource, "id"> | Omit<PdfSource, "id">;

/** Returns human-readable problems; an empty array means the type is valid. */
export function validateSource(input: unknown): string[] {
  const errors: string[] = [];
  const t = (input ?? {}) as Partial<CsvSource> & Partial<PdfSource>;
  if (typeof t.name !== "string" || t.name.trim() === "") {
    errors.push("Name is required");
  }
  if (t.format === "pdf") {
    const approach =
      typeof t.approach === "string" ? getApproach(t.approach) : undefined;
    if (!approach) {
      errors.push(`Unknown extraction approach "${String(t.approach)}"`);
    } else {
      errors.push(...approach.validateConfig(t.config));
    }
    return errors;
  }
  if (t.format !== "csv") errors.push("Unsupported format");
  if (typeof t.delimiter !== "string" || t.delimiter.length !== 1) {
    errors.push("Delimiter must be a single character");
  }
  if (typeof t.hasHeader !== "boolean") errors.push("hasHeader is required");
  for (const key of ["skipStartLines", "skipEndLines"] as const) {
    const v = t[key];
    if (v !== undefined && !(Number.isInteger(v) && v >= 0)) {
      errors.push(`${key} must be a non-negative integer`);
    }
  }
  errors.push(...validateMapping(t, false));
  return errors;
}

export interface ProcessResult {
  transactions: Transaction[];
  errors: RowError[];
  warnings: string[];
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
  return { transactions, errors, warnings: [] };
}

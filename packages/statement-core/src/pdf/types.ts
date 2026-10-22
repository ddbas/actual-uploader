import type { RowError } from "../mapping.js";
import type { Transaction } from "../transaction.js";

/** A run of text in a PDF, in PDF points with the origin at bottom-left. */
export interface TextItem {
  text: string;
  /** Left edge. */
  x: number;
  /** Baseline (bottom edge). */
  y: number;
  width: number;
  height: number;
}

export interface PdfPageItems {
  width: number;
  height: number;
  items: TextItem[];
}

export interface ApproachResult {
  transactions: Transaction[];
  errors: RowError[];
  warnings: string[];
}

/**
 * A strategy for turning the text items of a PDF into transactions. Its
 * configuration is opaque (and versioned) to everything but the approach.
 */
export interface Approach {
  id: string;
  /** Display name. */
  label: string;
  /** Configuration to start from for an example PDF. */
  initialConfig(pages: PdfPageItems[]): unknown;
  /** Human-readable problems with a configuration; empty means valid. */
  validateConfig(config: unknown): string[];
  /** Pure and free of I/O, so the browser and server give identical results. */
  run(pages: PdfPageItems[], config: unknown, account: string): ApproachResult;
}

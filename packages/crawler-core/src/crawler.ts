import type { Transaction } from "./transaction.js";

/**
 * The common contract every account crawler implements.
 *
 * `run()` returns an `AsyncGenerator` rather than a `Promise` so callers can
 * consume and forward transactions as soon as they are produced, instead of
 * waiting for the entire run to finish.
 */
export interface Crawler {
  /** Stable, unique identifier for this crawler. */
  readonly id: string;
  /** Human-readable name shown in the dashboard. */
  readonly name: string;
  /** Human-readable description shown in the dashboard. */
  readonly description: string;
  /** Runs the crawler, yielding transactions as they are collected. */
  run(): AsyncGenerator<Transaction, void, void>;
}

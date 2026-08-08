import type { Transaction } from "./types.js";

export type { Transaction } from "./types.js";

export interface CrawlerSummary {
  id: string;
  name: string;
  description: string;
}

export type CrawlerState = "idle" | "running" | "success" | "error";

export interface ResultTransaction extends Transaction {
  crawlerId: string;
  crawlerName: string;
}

export type ServerEvent =
  | { type: "state-snapshot"; states: Record<string, CrawlerState> }
  | { type: "crawler-started"; crawlerId: string }
  | { type: "crawler-progress"; crawlerId: string; state: CrawlerState }
  | {
      type: "transaction";
      crawlerId: string;
      crawlerName: string;
      transaction: Transaction;
    }
  | { type: "crawler-finished"; crawlerId: string }
  | { type: "crawler-failed"; crawlerId: string; error: string }
  | { type: "run-all-finished" };

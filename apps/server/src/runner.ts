import { EventEmitter } from "node:events";
import type { Crawler, Transaction } from "crawler-core";

export type CrawlerState = "idle" | "running" | "success" | "error";

export type RunnerEvent =
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

export interface CrawlerSummary {
  id: string;
  name: string;
  description: string;
}

/**
 * Orchestrates crawler runs and emits {@link RunnerEvent}s reflecting their
 * lifecycle. A failing crawler's run is isolated: the error is captured, a
 * `crawler-failed` event is emitted for that crawler only, and (in
 * {@link runAll}) the next crawler still runs.
 */
export class CrawlerRunner extends EventEmitter {
  private readonly crawlers: Map<string, Crawler>;
  private readonly states = new Map<string, CrawlerState>();

  constructor(crawlers: Iterable<Crawler>) {
    super();
    this.crawlers = new Map(Array.from(crawlers).map((c) => [c.id, c]));
    for (const id of this.crawlers.keys()) {
      this.states.set(id, "idle");
    }
  }

  listCrawlers(): CrawlerSummary[] {
    return Array.from(this.crawlers.values()).map(
      ({ id, name, description }) => ({ id, name, description }),
    );
  }

  getState(id: string): CrawlerState | undefined {
    return this.states.get(id);
  }

  /** Snapshot of every crawler's current state, used to sync new SSE clients. */
  getStates(): Record<string, CrawlerState> {
    return Object.fromEntries(this.states);
  }

  hasCrawler(id: string): boolean {
    return this.crawlers.has(id);
  }

  private emitEvent(event: RunnerEvent): void {
    this.emit("event", event);
  }

  private setState(id: string, state: CrawlerState): void {
    this.states.set(id, state);
    this.emitEvent({ type: "crawler-progress", crawlerId: id, state });
  }

  /** Runs a single crawler by id. Never throws: failures emit `crawler-failed`. */
  async runOne(id: string): Promise<void> {
    const crawler = this.crawlers.get(id);
    if (!crawler) {
      throw new Error(`No crawler registered with id "${id}"`);
    }

    this.emitEvent({ type: "crawler-started", crawlerId: id });
    this.setState(id, "running");

    try {
      for await (const transaction of crawler.run()) {
        this.emitEvent({
          type: "transaction",
          crawlerId: crawler.id,
          crawlerName: crawler.name,
          transaction,
        });
      }
      this.setState(id, "success");
      this.emitEvent({ type: "crawler-finished", crawlerId: id });
    } catch (error) {
      this.setState(id, "error");
      this.emitEvent({
        type: "crawler-failed",
        crawlerId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Runs every registered crawler in series, isolating failures. */
  async runAll(): Promise<void> {
    for (const id of this.crawlers.keys()) {
      await this.runOne(id);
    }
    this.emitEvent({ type: "run-all-finished" });
  }
}

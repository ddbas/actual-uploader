import type { Crawler, Transaction } from "crawler-core";
import { describe, expect, it } from "vitest";
import { CrawlerRunner, type RunnerEvent } from "./runner.js";

function makeTx(id: string): Transaction {
  return { account: "acc", date: "2024-01-01", amount: 100, imported_id: id };
}

function fakeCrawler(id: string, behavior: "ok" | "fail"): Crawler {
  return {
    id,
    name: `Crawler ${id}`,
    description: `Fake crawler ${id}`,
    async *run() {
      yield makeTx(id);
      if (behavior === "fail") {
        throw new Error(`boom-${id}`);
      }
    },
  };
}

function collectEvents(runner: CrawlerRunner): RunnerEvent[] {
  const events: RunnerEvent[] = [];
  runner.on("event", (event: RunnerEvent) => events.push(event));
  return events;
}

describe("CrawlerRunner", () => {
  it("lists crawlers without running them", () => {
    let ran = false;
    const runner = new CrawlerRunner([
      {
        id: "a",
        name: "A",
        description: "desc",
        // biome-ignore lint/correctness/useYield: this stub never yields on purpose to assert `run` isn't invoked.
        async *run() {
          ran = true;
        },
      },
    ]);

    expect(runner.listCrawlers()).toEqual([
      { id: "a", name: "A", description: "desc" },
    ]);
    expect(ran).toBe(false);
    expect(runner.getState("a")).toBe("idle");
  });

  it("runs a single crawler and emits its lifecycle events in order", async () => {
    const runner = new CrawlerRunner([fakeCrawler("a", "ok")]);
    const events = collectEvents(runner);

    await runner.runOne("a");

    expect(events.map((e) => e.type)).toEqual([
      "crawler-started",
      "crawler-progress",
      "transaction",
      "crawler-progress",
      "crawler-finished",
    ]);
    expect(runner.getState("a")).toBe("success");
  });

  it("isolates a failing crawler without throwing", async () => {
    const runner = new CrawlerRunner([fakeCrawler("a", "fail")]);
    const events = collectEvents(runner);

    await expect(runner.runOne("a")).resolves.toBeUndefined();

    expect(events.at(-1)).toMatchObject({
      type: "crawler-failed",
      crawlerId: "a",
    });
    expect(runner.getState("a")).toBe("error");
  });

  it("runs crawlers in series via runAll, isolating failures", async () => {
    const runner = new CrawlerRunner([
      fakeCrawler("first", "fail"),
      fakeCrawler("second", "ok"),
    ]);
    const events = collectEvents(runner);

    await runner.runAll();

    const firstFailedIdx = events.findIndex(
      (e) => e.type === "crawler-failed" && e.crawlerId === "first",
    );
    const secondStartedIdx = events.findIndex(
      (e) => e.type === "crawler-started" && e.crawlerId === "second",
    );
    const secondFinishedIdx = events.findIndex(
      (e) => e.type === "crawler-finished" && e.crawlerId === "second",
    );
    const runAllFinishedIdx = events.findIndex(
      (e) => e.type === "run-all-finished",
    );

    expect(firstFailedIdx).toBeGreaterThanOrEqual(0);
    expect(secondStartedIdx).toBeGreaterThan(firstFailedIdx);
    expect(secondFinishedIdx).toBeGreaterThan(secondStartedIdx);
    expect(runAllFinishedIdx).toBe(events.length - 1);

    expect(runner.getState("first")).toBe("error");
    expect(runner.getState("second")).toBe("success");
  });

  it("throws when running an unknown crawler id", async () => {
    const runner = new CrawlerRunner([]);
    await expect(runner.runOne("missing")).rejects.toThrow(
      /No crawler registered/,
    );
  });
});

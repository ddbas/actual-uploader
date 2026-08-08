import type { AddressInfo } from "node:net";
import type { Crawler, Transaction } from "crawler-core";
import { afterEach, describe, expect, it } from "vitest";
import type { RunnerEvent } from "./runner.js";
import { createServer } from "./server.js";

function makeTx(id: string): Transaction {
  return { account: "acc", date: "2024-01-01", amount: 100, imported_id: id };
}

function fakeCrawler(
  id: string,
  behavior: "ok" | "fail",
  transactions: Transaction[] = [makeTx(id)],
): Crawler {
  return {
    id,
    name: `Crawler ${id}`,
    description: `Fake crawler ${id}`,
    async *run() {
      for (const tx of transactions) {
        yield tx;
      }
      if (behavior === "fail") {
        throw new Error(`boom-${id}`);
      }
    },
  };
}

async function readSseEvents(
  url: string,
  count: number,
  signal: AbortSignal,
): Promise<RunnerEvent[]> {
  const res = await fetch(url, { signal });
  if (!res.body) {
    throw new Error("Expected a response body");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: RunnerEvent[] = [];
  let buffer = "";

  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const parsed = JSON.parse(line.slice("data: ".length));
      events.push(parsed);
    }
  }

  reader.cancel().catch(() => {});
  return events;
}

describe("server", () => {
  let baseUrl: string;
  let close: () => Promise<void>;

  async function start(crawlers: Crawler[]) {
    const { server } = createServer({ crawlers });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    close = () => new Promise((resolve) => server.close(() => resolve()));
  }

  afterEach(async () => {
    await close?.();
  });

  it("lists registered crawlers without running them", async () => {
    let ran = false;
    const crawler: Crawler = {
      id: "x",
      name: "X",
      description: "desc",
      // biome-ignore lint/correctness/useYield: this stub never yields on purpose to assert `run` isn't invoked.
      async *run() {
        ran = true;
      },
    };
    await start([crawler]);

    const res = await fetch(`${baseUrl}/api/crawlers`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([{ id: "x", name: "X", description: "desc" }]);
    expect(ran).toBe(false);
  });

  it("streams a single crawler's lifecycle over SSE", async () => {
    await start([fakeCrawler("a", "ok")]);

    const controller = new AbortController();
    const eventsPromise = readSseEvents(
      `${baseUrl}/api/events`,
      5,
      controller.signal,
    );
    // Give the SSE client a moment to connect before triggering the run.
    await new Promise((r) => setTimeout(r, 20));
    await fetch(`${baseUrl}/api/crawlers/a/run`, { method: "POST" });

    const events = await eventsPromise;
    controller.abort();

    const types = events.map((e) => e.type);
    expect(types).toContain("crawler-started");
    expect(types).toContain("transaction");
    expect(types).toContain("crawler-finished");
    expect(types).not.toContain("crawler-failed");
  });

  it("runs all crawlers in series and isolates a failing crawler", async () => {
    await start([fakeCrawler("first", "fail"), fakeCrawler("second", "ok")]);

    const controller = new AbortController();
    const eventsPromise = readSseEvents(
      `${baseUrl}/api/events`,
      8,
      controller.signal,
    );
    await new Promise((r) => setTimeout(r, 20));
    await fetch(`${baseUrl}/api/run-all`, { method: "POST" });

    const events = await eventsPromise;
    controller.abort();

    const firstFinishedIdx = events.findIndex(
      (e) => e.type === "crawler-failed" && e.crawlerId === "first",
    );
    const secondStartedIdx = events.findIndex(
      (e) => e.type === "crawler-started" && e.crawlerId === "second",
    );
    const runAllFinishedIdx = events.findIndex(
      (e) => e.type === "run-all-finished",
    );

    expect(firstFinishedIdx).toBeGreaterThanOrEqual(0);
    expect(secondStartedIdx).toBeGreaterThan(firstFinishedIdx);
    expect(runAllFinishedIdx).toBeGreaterThan(secondStartedIdx);
  });

  it("returns 404 for an unknown crawler id", async () => {
    await start([]);
    const res = await fetch(`${baseUrl}/api/crawlers/unknown/run`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

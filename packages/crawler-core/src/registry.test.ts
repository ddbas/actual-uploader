import { beforeEach, describe, expect, it } from "vitest";
import type { Crawler } from "./crawler.js";
import {
  clearCrawlerRegistry,
  getCrawler,
  getCrawlers,
  registerCrawler,
} from "./registry.js";

function makeCrawler(id: string): Crawler {
  return {
    id,
    name: `Crawler ${id}`,
    description: `Test crawler ${id}`,
    async *run() {
      // no-op; type-level conformance only
    },
  };
}

describe("crawler registry", () => {
  beforeEach(() => {
    clearCrawlerRegistry();
  });

  it("returns an empty list when nothing is registered", () => {
    expect(getCrawlers()).toEqual([]);
  });

  it("registers and lists crawlers without invoking run", async () => {
    let ran = false;
    const crawler: Crawler = {
      id: "a",
      name: "A",
      description: "Crawler A",
      // biome-ignore lint/correctness/useYield: this stub never yields on purpose to assert `run` isn't invoked.
      async *run() {
        ran = true;
      },
    };

    registerCrawler(crawler);

    expect(getCrawlers()).toEqual([crawler]);
    expect(ran).toBe(false);
  });

  it("looks up a single crawler by id", () => {
    const crawler = makeCrawler("b");
    registerCrawler(crawler);

    expect(getCrawler("b")).toBe(crawler);
    expect(getCrawler("missing")).toBeUndefined();
  });

  it("throws when registering a duplicate id", () => {
    registerCrawler(makeCrawler("dup"));

    expect(() => registerCrawler(makeCrawler("dup"))).toThrow(
      /already registered/,
    );
  });

  it("clears the registry", () => {
    registerCrawler(makeCrawler("c"));
    clearCrawlerRegistry();

    expect(getCrawlers()).toEqual([]);
  });
});

describe("Crawler interface conformance", () => {
  it("accepts an object implementing id, name, description, and run", async () => {
    const crawler: Crawler = makeCrawler("conformant");
    registerCrawler(crawler);

    const results = [];
    for await (const transaction of crawler.run()) {
      results.push(transaction);
    }

    expect(getCrawlers()).toContain(crawler);
    expect(results).toEqual([]);
  });
});

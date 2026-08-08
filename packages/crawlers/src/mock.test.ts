import { beforeEach, describe, expect, it, vi } from "vitest";

const waitForTimeout = vi.fn(async () => {});
const goto = vi.fn(async () => {});
const newPage = vi.fn(async () => ({ goto, waitForTimeout }));
const close = vi.fn(async () => {});
const launch = vi.fn(async () => ({ newPage, close }));

vi.mock("playwright", () => ({
  chromium: { launch: (...args: unknown[]) => launch(...(args as [])) },
}));

describe("mock crawler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conforms to the Crawler interface", async () => {
    const { mockCrawler } = await import("./mock.js");

    expect(mockCrawler.id).toBe("mock");
    expect(mockCrawler.name).toBe("Desjardins (Mock)");
    expect(typeof mockCrawler.description).toBe("string");
    expect(typeof mockCrawler.run).toBe("function");
  });

  it("navigates to the Desjardins auth URL, waits 5s, and closes the browser before yielding", async () => {
    const { mockCrawler, MOCK_CRAWLER_URL } = await import("./mock.js");

    const transactions = [];
    for await (const transaction of mockCrawler.run()) {
      transactions.push(transaction);
      // The browser must already be closed by the time any transaction is yielded.
      expect(close).toHaveBeenCalledTimes(1);
    }

    expect(launch).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith(MOCK_CRAWLER_URL);
    expect(waitForTimeout).toHaveBeenCalledWith(5000);
    expect(close).toHaveBeenCalledTimes(1);
    expect(transactions.length).toBeGreaterThan(0);
    for (const transaction of transactions) {
      expect(transaction.account).toBeTruthy();
      expect(transaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof transaction.amount).toBe("number");
    }
  });

  it("closes the browser even if navigation fails", async () => {
    goto.mockRejectedValueOnce(new Error("navigation failed"));
    const { mockCrawler } = await import("./mock.js");

    await expect(async () => {
      for await (const _ of mockCrawler.run()) {
        // no-op
      }
    }).rejects.toThrow("navigation failed");

    expect(close).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchActualStatus, importTransactions } from "./api.js";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("fetchActualStatus returns the server status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"connected":true}')),
    );
    expect(await fetchActualStatus()).toEqual({ connected: true });
  });

  it("fetchActualStatus reports not connected when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect((await fetchActualStatus()).connected).toBe(false);
  });

  it("importTransactions posts and returns counts", async () => {
    const fn = vi.fn(
      async (_u: unknown, _i?: RequestInit) =>
        new Response('{"added":2,"updated":1}'),
    );
    vi.stubGlobal("fetch", fn);
    const txs = [{ account: "a", date: "2024-01-01" }];
    expect(await importTransactions(txs)).toEqual({ added: 2, updated: 1 });
    expect(fn.mock.calls[0]?.[0]).toBe("/api/actual/import");
    expect(JSON.parse(String(fn.mock.calls[0]?.[1]?.body))).toEqual({
      transactions: txs,
    });
  });

  it("importTransactions throws the server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"nope"}', { status: 502 })),
    );
    await expect(importTransactions([])).rejects.toThrow("nope");
  });
});

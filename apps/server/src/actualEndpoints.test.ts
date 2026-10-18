import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActualClient } from "./actualClient.js";
import { createServer } from "./server.js";

const servers: ReturnType<typeof createServer>["server"][] = [];
async function start(client: Partial<ActualClient>) {
  const { server } = createServer({ actualClient: client as ActualClient });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", body: JSON.stringify(body) });

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe("GET /api/actual/status", () => {
  it("returns connected", async () => {
    const base = await start({ getStatus: async () => ({ connected: true }) });
    const res = await fetch(`${base}/api/actual/status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
  });
  it("returns not connected with 200", async () => {
    const base = await start({
      getStatus: async () => ({ connected: false, error: "bad password" }),
    });
    const res = await fetch(`${base}/api/actual/status`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: false,
      error: "bad password",
    });
  });
});

describe("GET /api/accounts", () => {
  it("returns real accounts", async () => {
    const base = await start({
      listAccounts: async () => [{ id: "a1", name: "Chequing" }],
    });
    const res = await fetch(`${base}/api/accounts`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "a1", name: "Chequing" }]);
  });
  it("returns 502 when not connected", async () => {
    const base = await start({
      listAccounts: async () => {
        throw new Error("unreachable");
      },
    });
    const res = await fetch(`${base}/api/accounts`);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unreachable" });
  });
});

describe("POST /api/actual/import", () => {
  const txs = [{ account: "a1", date: "2024-01-01", amount: -100 }];
  it("imports and returns counts", async () => {
    const importTransactions = vi.fn(async () => ({ added: 1, updated: 0 }));
    const base = await start({ importTransactions });
    const res = await post(`${base}/api/actual/import`, { transactions: txs });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ added: 1, updated: 0 });
    expect(importTransactions).toHaveBeenCalledWith(txs);
  });
  it("rejects invalid bodies with 400", async () => {
    const importTransactions = vi.fn();
    const base = await start({ importTransactions });
    for (const body of [
      {},
      { transactions: [] },
      { transactions: [{ date: "2024-01-01" }] },
    ]) {
      expect((await post(`${base}/api/actual/import`, body)).status).toBe(400);
    }
    const bad = await fetch(`${base}/api/actual/import`, {
      method: "POST",
      body: "nope",
    });
    expect(bad.status).toBe(400);
    expect(importTransactions).not.toHaveBeenCalled();
  });
  it("returns 502 on failure", async () => {
    const base = await start({
      importTransactions: async () => {
        throw new Error("boom");
      },
    });
    const res = await post(`${base}/api/actual/import`, { transactions: txs });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});

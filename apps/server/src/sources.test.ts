import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "./server.js";
import { SourceStore } from "./sourceStore.js";

const valid = {
  name: "Desjardins",
  format: "csv",
  delimiter: ",",
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "YYYY MM DD",
  amount: { kind: "single", column: 1 },
  decimalSeparator: ".",
};

const servers: ReturnType<typeof createServer>["server"][] = [];
async function start(store?: SourceStore) {
  const { server } = createServer({ sources: store });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", body: JSON.stringify(body) });

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe("account API", () => {
  it("lists accounts with an id and a display name", async () => {
    const base = await start();
    const accounts = (await (await fetch(`${base}/api/accounts`)).json()) as {
      id: string;
      name: string;
    }[];
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
    });
  });
});

describe("source API", () => {
  it("rejects invalid sources", async () => {
    const base = await start();
    const { amount: _a, ...noAmount } = valid;
    const res = await post(`${base}/api/sources`, noAmount);
    expect(res.status).toBe(400);
    expect(await (await fetch(`${base}/api/sources`)).json()).toEqual([]);
  });

  it("creates, lists, processes and deletes", async () => {
    const base = await start();
    const created = (await (
      await post(`${base}/api/sources`, valid)
    ).json()) as { id: string };
    expect(created.id).toBeTruthy();
    expect(await (await fetch(`${base}/api/sources`)).json()).toHaveLength(1);

    const res = await post(`${base}/api/sources/${created.id}/process`, {
      account: "acc",
      content: "d,a\n2024-01-02,-3.50\n",
    });
    expect(
      ((await res.json()) as { transactions: unknown }).transactions,
    ).toEqual([{ account: "acc", date: "2024-01-02", amount: -350 }]);

    const del = await fetch(`${base}/api/sources/${created.id}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);
    expect(
      (
        await fetch(`${base}/api/sources/${created.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(404);
  });

  it("persists across restarts", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "ac-")), "nested", "t.json");
    const base = await start(new SourceStore(file));
    await post(`${base}/api/sources`, valid);
    const base2 = await start(new SourceStore(file));
    const list = await (await fetch(`${base2}/api/sources`)).json();
    expect(list).toHaveLength(1);
  });
});

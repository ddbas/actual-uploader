import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPdf } from "statement-pdf/testing";
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

const pdfSource = {
  name: "Card",
  format: "pdf",
  approach: "aligned-columns",
  config: {
    version: 1,
    dividers: [100, 300],
    yearAnchor: { page: 1, x: 45, y: 743 },
    mapping: {
      dateColumn: 0,
      dateFormat: "DD MM",
      amount: { kind: "single", column: 2 },
      decimalSeparator: ".",
      payeeColumn: 1,
    },
  },
};
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const statement = buildPdf([
  [
    { text: "Statement 2026", x: 40, y: 740 },
    { text: "03 09", x: 40, y: 700 },
    { text: "COFFEE", x: 130, y: 700 },
    { text: "4.50", x: 520, y: 700 },
    { text: "Total 4.50", x: 130, y: 680 },
  ],
]);

describe("PDF sources", () => {
  async function create(base: string, body: unknown = pdfSource) {
    return (await (await post(`${base}/api/sources`, body)).json()) as {
      id: string;
    };
  }

  it("stores a valid PDF source", async () => {
    const base = await start();
    const res = await post(`${base}/api/sources`, pdfSource);
    expect(res.status).toBe(201);
    expect(await (await fetch(`${base}/api/sources`)).json()).toMatchObject([
      { format: "pdf", approach: "aligned-columns" },
    ]);
  });

  it("rejects invalid configs and unknown approaches", async () => {
    const base = await start();
    const bad = await post(`${base}/api/sources`, {
      ...pdfSource,
      config: { version: 1 },
    });
    expect(bad.status).toBe(400);
    const unknown = await post(`${base}/api/sources`, {
      ...pdfSource,
      approach: "magic",
    });
    expect(unknown.status).toBe(400);
    expect(await (await fetch(`${base}/api/sources`)).json()).toEqual([]);
  });

  it("processes a PDF", async () => {
    const base = await start();
    const { id } = await create(base);
    const res = await post(`${base}/api/sources/${id}/process`, {
      account: "acc",
      contentBase64: base64(statement),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      transactions: [
        {
          account: "acc",
          date: "2026-09-03",
          amount: 450,
          payee_name: "COFFEE",
          imported_payee: "COFFEE",
        },
      ],
      errors: [],
      warnings: [],
    });
  });

  it("returns 4xx naming the reason for unreadable PDFs", async () => {
    const base = await start();
    const { id } = await create(base);
    const send = async (bytes: Uint8Array) => {
      const res = await post(`${base}/api/sources/${id}/process`, {
        account: "acc",
        contentBase64: base64(bytes),
      });
      return [res.status, (await res.json()) as { error: string }] as const;
    };
    const [s1, notPdf] = await send(new TextEncoder().encode("hello"));
    expect(s1).toBe(400);
    expect(notPdf.error).toMatch(/not a readable PDF/);
    const [s2, noText] = await send(buildPdf([[]]));
    expect(s2).toBe(400);
    expect(noText.error).toMatch(/no readable text/);
    const [s3, enc] = await send(
      buildPdf([[{ text: "x", x: 1, y: 1 }]], { encrypt: true }),
    );
    expect(s3).toBe(400);
    expect(enc.error).toMatch(/password-protected/);
  });

  it("requires the PDF content", async () => {
    const base = await start();
    const { id } = await create(base);
    const res = await post(`${base}/api/sources/${id}/process`, {
      account: "acc",
      content: "x",
    });
    expect(res.status).toBe(400);
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

  it("loads a data file written before PDF support", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "ac-")), "t.json");
    writeFileSync(
      file,
      JSON.stringify([{ id: "old", ...valid, flipAmount: false }]),
    );
    const base = await start(new SourceStore(file));
    expect(await (await fetch(`${base}/api/sources`)).json()).toHaveLength(1);
    const res = await post(`${base}/api/sources/old/process`, {
      account: "acc",
      content: "d,a\n2024-01-02,-3.50\n",
    });
    expect(await res.json()).toEqual({
      transactions: [{ account: "acc", date: "2024-01-02", amount: -350 }],
      errors: [],
      warnings: [],
    });
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

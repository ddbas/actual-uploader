import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ActualApi, createActualClient } from "./actualClient.js";
import { ActualSettingsStore } from "./actualSettingsStore.js";
import { createCapturingLogger } from "./logger.js";
import { createServer } from "./server.js";

const settings = {
  serverUrl: "https://actual.example.com",
  serverPassword: "hunter2",
  syncId: "sync-1",
  encryptionPassword: "e2e-secret",
};

function fakeApi(overrides: Partial<ActualApi> = {}): ActualApi {
  return {
    init: vi.fn(async () => {}),
    downloadBudget: vi.fn(async () => {}),
    getAccounts: vi.fn(async () => [{ id: "a1", name: "Chequing" }]),
    importTransactions: vi.fn(async () => ({
      added: ["x", "y"],
      updated: ["z"],
      errors: [],
    })),
    sync: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("actual client logging", () => {
  it("logs a sanitized warning on failure", async () => {
    const { logger, entries } = createCapturingLogger();
    const client = createActualClient({
      getSettings: () => settings,
      dataDir: "/tmp/actual-logging-test",
      loadApi: async () =>
        fakeApi({
          downloadBudget: vi.fn(async () => {
            throw new Error("bad key hunter2 / e2e-secret");
          }),
        }),
      logger,
    });
    await client.getStatus();
    const warn = entries.find((e) => e.level === 40);
    expect(warn?.msg).toContain("***");
    const text = JSON.stringify(entries);
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("e2e-secret");
  });

  it("logs import counts at info and shutdown failures at warn", async () => {
    const { logger, entries } = createCapturingLogger();
    const client = createActualClient({
      getSettings: () => settings,
      dataDir: "/tmp/actual-logging-test",
      loadApi: async () =>
        fakeApi({
          shutdown: vi.fn(async () => {
            throw new Error("boom");
          }),
        }),
      logger,
    });
    await client.importTransactions([
      { account: "a1", date: "2024-01-01", payee_name: "SECRET PAYEE" },
    ]);
    expect(entries).toContainEqual(
      expect.objectContaining({ level: 30, added: 2, updated: 1 }),
    );
    expect(entries.some((e) => e.level === 40 && /shutdown/.test(`${e.msg}`)));
    expect(JSON.stringify(entries)).not.toContain("SECRET PAYEE");
  });

  it("warns when settings are incomplete", async () => {
    const { logger, entries } = createCapturingLogger();
    const client = createActualClient({
      getSettings: () => ({ ...settings, serverUrl: "" }),
      dataDir: "/tmp/actual-logging-test",
      loadApi: async () => fakeApi(),
      logger,
    });
    await client.getStatus();
    expect(entries.some((e) => e.level === 40)).toBe(true);
  });
});

describe("actual connection diagnostics", () => {
  it("logs the failing phase, cause chain and timing without secrets", async () => {
    const { logger, entries } = createCapturingLogger();
    const cause = Object.assign(new Error("connect ECONNREFUSED hunter2"), {
      code: "ECONNREFUSED",
      syscall: "connect",
    });
    const client = createActualClient({
      getSettings: () => settings,
      dataDir: "/tmp/actual-logging-test",
      loadApi: async () =>
        fakeApi({
          init: vi.fn(async () => {
            throw new Error("fetch failed", { cause });
          }),
        }),
      logger,
    });
    await client.getStatus();
    const warn = entries.find((e) => e.level === 40) as Record<
      string,
      unknown
    > & { error: { cause: unknown } };
    expect(warn.phase).toBe("init");
    expect(warn.serverUrl).toBe(settings.serverUrl);
    expect(warn.error.cause).toMatchObject({
      code: "ECONNREFUSED",
      syscall: "connect",
    });
    expect(typeof warn.durationMs).toBe("number");
    expect(JSON.stringify(entries)).not.toContain("hunter2");
    expect(entries.some((e) => e.phase === "init" && e.level === 20)).toBe(
      true,
    );
  });

  it("reports the phase that timed out", async () => {
    const { logger, entries } = createCapturingLogger();
    const client = createActualClient({
      getSettings: () => settings,
      dataDir: "/tmp/actual-logging-test",
      loadApi: async () =>
        fakeApi({ downloadBudget: () => new Promise(() => {}) }),
      timeoutMs: 20,
      logger,
    });
    await client.getStatus();
    const warn = entries.find((e) => e.level === 40) as Record<string, unknown>;
    expect(warn.phase).toBe("download-budget");
    expect(warn.msg).toContain("Timed out");
  });
});

describe("settings store logging", () => {
  it("logs changed field names only", () => {
    const { logger, entries } = createCapturingLogger();
    const store = new ActualSettingsStore(undefined, {}, logger);
    store.update({
      serverUrl: "https://a.example.com",
      syncId: "s",
      serverPassword: "topsecret",
    });
    const text = JSON.stringify(entries);
    expect(text).not.toContain("topsecret");
    expect(entries.at(-1)?.changed).toEqual([
      "serverUrl",
      "serverPassword",
      "syncId",
    ]);
  });
});

describe("http logging", () => {
  const servers: ReturnType<typeof createServer>["server"][] = [];
  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
  });
  async function start(actualClient: object) {
    const cap = createCapturingLogger();
    const { server } = createServer({
      logger: cap.logger,
      actualClient: actualClient as never,
    });
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { ...cap, base };
  }

  it("logs request method, path, status and duration by level", async () => {
    const { base, entries } = await start({});
    await fetch(`${base}/api/sources`);
    await fetch(`${base}/nope`);
    await fetch(`${base}/api/actual/import`, { method: "POST", body: "{" });
    const find = (path: string, level: number) =>
      entries.find((e) => e.path === path && e.level === level);
    expect(find("/api/sources", 20)).toMatchObject({
      method: "GET",
      status: 200,
    });
    expect(typeof find("/api/sources", 20)?.durationMs).toBe("number");
    expect(find("/nope", 40)).toMatchObject({ status: 404 });
    expect(find("/api/actual/import", 40)).toMatchObject({ status: 400 });
  });

  it("logs unexpected handler errors with stack at error", async () => {
    const cap = createCapturingLogger();
    const { server } = createServer({
      logger: cap.logger,
      actualSettings: {
        get: () => {
          throw new Error("kaboom");
        },
      } as never,
      actualClient: {} as never,
    });
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const res = await fetch(`${base}/api/settings/actual`);
    expect(res.status).toBe(500);
    const err = cap.entries.find(
      (e) => e.level === 50 && e.route === "settings",
    );
    expect((err?.err as { stack?: string })?.stack).toContain("kaboom");
  });

  it("does not log transaction data", async () => {
    const { base, entries } = await start({
      importTransactions: async () => ({ added: 1, updated: 0 }),
    });
    await fetch(`${base}/api/actual/import`, {
      method: "POST",
      body: JSON.stringify({
        transactions: [
          { account: "a", date: "2024-01-01", payee_name: "SECRET PAYEE" },
        ],
      }),
    });
    expect(JSON.stringify(entries)).not.toContain("SECRET PAYEE");
  });
});

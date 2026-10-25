import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ActualApi,
  ActualRateLimitError,
  createActualClient,
} from "./actualClient.js";
import {
  type ActualSettings,
  ActualSettingsStore,
} from "./actualSettingsStore.js";
import { createLogger } from "./logger.js";

const settings: ActualSettings = {
  serverUrl: "https://actual.example.com",
  serverPassword: "hunter2",
  syncId: "sync-1",
  encryptionPassword: "e2e-secret",
};

function fakeApi(overrides: Partial<ActualApi> = {}): ActualApi {
  return {
    init: vi.fn(async () => {}),
    downloadBudget: vi.fn(async () => {}),
    getAccounts: vi.fn(async () => [
      { id: "a1", name: "Chequing", offbudget: false },
    ]),
    importTransactions: vi.fn(async () => ({
      added: ["x"],
      updated: [],
      errors: [],
    })),
    sync: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    ...overrides,
  };
}

const make = (api: ActualApi, s: ActualSettings = settings) =>
  createActualClient({
    getSettings: () => s,
    dataDir: "/tmp/actual-client-test",
    loadApi: async () => api,
    timeoutMs: 50,
  });

describe("actual client", () => {
  it("reports connected and keeps the session open", async () => {
    const api = fakeApi();
    expect(await make(api).getStatus()).toEqual({ connected: true });
    expect(api.init).toHaveBeenCalledWith({
      serverURL: settings.serverUrl,
      password: "hunter2",
      dataDir: "/tmp/actual-client-test",
    });
    expect(api.downloadBudget).toHaveBeenCalledWith("sync-1", {
      password: "e2e-secret",
    });
    expect(api.shutdown).not.toHaveBeenCalled();
  });

  it("reports failure without leaking secrets, and shuts down", async () => {
    const api = fakeApi({
      downloadBudget: vi.fn(async () => {
        throw new Error("bad key hunter2 / e2e-secret");
      }),
    });
    const status = await make(api).getStatus();
    expect(status.connected).toBe(false);
    expect(status.error).toBe("bad key *** / ***");
    expect(api.shutdown).toHaveBeenCalledOnce();
  });

  it("masks env-provided passwords in errors", async () => {
    const store = new ActualSettingsStore(undefined, {
      serverPassword: "env-pw",
      encryptionPassword: "env-e2e",
    });
    const api = fakeApi({
      init: vi.fn(async () => {
        throw new Error("denied env-pw env-e2e");
      }),
    });
    const client = createActualClient({
      getSettings: () => ({
        ...store.getSecret(),
        serverUrl: "https://a.b",
        syncId: "s",
      }),
      dataDir: "/tmp/x",
      loadApi: async () => api,
      timeoutMs: 50,
    });
    expect((await client.getStatus()).error).toBe("denied *** ***");
  });

  it("is not connected without contacting the network when incomplete", async () => {
    const api = fakeApi();
    const status = await make(api, { ...settings, syncId: "" }).getStatus();
    expect(status.connected).toBe(false);
    expect(api.init).not.toHaveBeenCalled();
  });

  it("times out", async () => {
    const api = fakeApi({ init: () => new Promise(() => {}) });
    const status = await make(api).getStatus();
    expect(status).toEqual({
      connected: false,
      error: "Timed out connecting to Actual",
    });
  });

  it("lists accounts as id and name", async () => {
    expect(await make(fakeApi()).listAccounts()).toEqual([
      { id: "a1", name: "Chequing" },
    ]);
  });

  it("syncs before listing accounts, without extra logins", async () => {
    const events: string[] = [];
    const api = fakeApi({
      sync: vi.fn(async () => {
        events.push("sync");
      }),
      getAccounts: vi.fn(async () => {
        events.push("get");
        return [{ id: "a1", name: "Chequing" }];
      }),
    });
    const client = make(api);
    await client.listAccounts();
    await client.listAccounts();
    expect(events).toEqual(["sync", "get", "sync", "get"]);
    expect(api.init).toHaveBeenCalledOnce();
    expect(api.downloadBudget).toHaveBeenCalledOnce();
  });

  it("returns local accounts when the pre-listing sync fails", async () => {
    const api = fakeApi({
      sync: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const client = make(api);
    expect(await client.listAccounts()).toEqual([
      { id: "a1", name: "Chequing" },
    ]);
    await client.listAccounts();
    expect(api.init).toHaveBeenCalledOnce();
    expect(api.shutdown).not.toHaveBeenCalled();
  });

  it("rethrows rate-limit errors from the pre-listing sync", async () => {
    const api = fakeApi({
      sync: vi.fn(async () => {
        throw new Error("too-many-requests");
      }),
    });
    await expect(make(api).listAccounts()).rejects.toThrow(/rate-limiting/);
  });

  it("imports grouped by account and syncs", async () => {
    const api = fakeApi();
    const result = await make(api).importTransactions([
      { account: "a1", date: "2024-01-01" },
      { account: "a2", date: "2024-01-02" },
      { account: "a1", date: "2024-01-03" },
    ]);
    expect(result).toEqual({ added: 2, updated: 0 });
    expect(api.importTransactions).toHaveBeenCalledTimes(2);
    expect(api.sync).toHaveBeenCalledOnce();
  });

  it("serializes operations", async () => {
    const events: string[] = [];
    let n = 0;
    const api = fakeApi({
      init: vi.fn(async () => {
        const id = ++n;
        events.push(`start${id}`);
        await new Promise((r) => setTimeout(r, 10));
        events.push(`end${id}`);
      }),
    });
    const client = make(api);
    await Promise.all([client.getStatus(), client.listAccounts()]);
    // The second operation reuses the session instead of logging in again.
    expect(events).toEqual(["start1", "end1"]);
  });

  describe("session reuse", () => {
    afterEach(() => vi.useRealTimers());

    const makeWith = (
      api: ActualApi,
      get: () => ActualSettings,
      extra: Record<string, unknown> = {},
    ) =>
      createActualClient({
        getSettings: get,
        dataDir: "/tmp/actual-client-test",
        loadApi: async () => api,
        timeoutMs: 50,
        ...extra,
      });

    it("logs in once for several operations", async () => {
      const api = fakeApi();
      const client = make(api);
      await client.listAccounts();
      await client.listAccounts();
      await client.importTransactions([{ account: "a1", date: "2024-01-01" }]);
      expect(api.init).toHaveBeenCalledOnce();
      expect(api.downloadBudget).toHaveBeenCalledOnce();
    });

    it("reopens after the settings change", async () => {
      const api = fakeApi();
      let current = settings;
      const client = makeWith(api, () => current);
      await client.listAccounts();
      current = { ...settings, syncId: "sync-2" };
      await client.listAccounts();
      expect(api.init).toHaveBeenCalledTimes(2);
      expect(api.shutdown).toHaveBeenCalledOnce();
    });

    it("drops the session on failure", async () => {
      const api = fakeApi();
      const client = make(api);
      await client.listAccounts();
      (api.importTransactions as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("boom"),
      );
      await expect(
        client.importTransactions([{ account: "a", date: "d" }]),
      ).rejects.toThrow("boom");
      expect(api.shutdown).toHaveBeenCalledOnce();
      await client.listAccounts();
      expect(api.init).toHaveBeenCalledTimes(2);
    });

    it("retries once with a fresh session when a reused one fails", async () => {
      const api = fakeApi();
      const client = make(api);
      await client.listAccounts();
      (api.getAccounts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("stale"),
      );
      expect(await client.listAccounts()).toEqual([
        { id: "a1", name: "Chequing" },
      ]);
      expect(api.init).toHaveBeenCalledTimes(2);
    });

    it("shuts the session down after the idle timeout", async () => {
      vi.useFakeTimers();
      const api = fakeApi();
      const client = makeWith(api, () => settings, {
        idleTimeoutMs: 1000,
        timeoutMs: 5000,
      });
      await client.listAccounts();
      await vi.advanceTimersByTimeAsync(999);
      expect(api.shutdown).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2);
      expect(api.shutdown).toHaveBeenCalledOnce();
      await client.listAccounts();
      expect(api.init).toHaveBeenCalledTimes(2);
    });
  });

  describe("status cache", () => {
    afterEach(() => vi.useRealTimers());

    it("shares one check and refreshes after invalidate or expiry", async () => {
      vi.useFakeTimers();
      const api = fakeApi();
      const lines: string[] = [];
      const logger = createLogger(
        "debug",
        new Writable({
          write(chunk, _enc, cb) {
            lines.push(String(chunk));
            cb();
          },
        }),
      );
      const checks = () =>
        lines.filter((l) => l.includes("Actual operation started")).length;
      const client = createActualClient({
        getSettings: () => settings,
        dataDir: "/tmp/actual-client-test",
        loadApi: async () => api,
        timeoutMs: 5000,
        statusCacheMs: 15_000,
        logger,
      });
      await client.getStatus();
      await client.getStatus();
      expect(checks()).toBe(1);
      client.invalidate?.();
      await client.getStatus();
      expect(checks()).toBe(2);
      await vi.advanceTimersByTimeAsync(15_001);
      await client.getStatus();
      expect(checks()).toBe(3);
    });
  });

  describe("rate limiting", () => {
    afterEach(() => vi.useRealTimers());

    it("backs off without network calls, then recovers", async () => {
      vi.useFakeTimers();
      const api = fakeApi({
        init: vi
          .fn()
          .mockRejectedValueOnce(
            new Error("Authentication failed: too-many-requests"),
          )
          .mockResolvedValue(undefined),
      });
      const client = createActualClient({
        getSettings: () => settings,
        dataDir: "/tmp/actual-client-test",
        loadApi: async () => api,
        timeoutMs: 5000,
        statusCacheMs: 0,
      });
      expect(await client.getStatus()).toEqual({
        connected: false,
        error: "Actual is rate-limiting logins; retrying in 60 s.",
        retryAfterSeconds: 60,
      });
      await vi.advanceTimersByTimeAsync(10_000);
      const blocked = await client.getStatus();
      expect(blocked.retryAfterSeconds).toBe(50);
      await expect(client.listAccounts()).rejects.toBeInstanceOf(
        ActualRateLimitError,
      );
      expect(api.init).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(50_001);
      expect(await client.getStatus()).toEqual({ connected: true });
      expect(api.init).toHaveBeenCalledTimes(2);
    });
  });
});

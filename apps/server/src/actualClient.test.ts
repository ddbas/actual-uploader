import { describe, expect, it, vi } from "vitest";
import { type ActualApi, createActualClient } from "./actualClient.js";
import type { ActualSettings } from "./actualSettingsStore.js";

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
  it("reports connected and shuts down", async () => {
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
    expect(api.shutdown).toHaveBeenCalledOnce();
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
    expect(events).toEqual(["start1", "end1", "start2", "end2"]);
  });
});

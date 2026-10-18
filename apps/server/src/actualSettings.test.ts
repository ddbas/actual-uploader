import { mkdtempSync, statSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActualSettingsStore,
  validateActualSettings,
} from "./actualSettingsStore.js";
import { createServer } from "./server.js";

const valid = {
  serverUrl: "https://actual.example.com",
  serverPassword: "pw",
  syncId: "abc-123",
  encryptionPassword: "e2e",
};

describe("validateActualSettings", () => {
  it("accepts valid input", () => {
    expect(validateActualSettings(valid)).toEqual({});
  });
  it("requires url", () => {
    expect(validateActualSettings({ ...valid, serverUrl: "" })).toHaveProperty(
      "serverUrl",
    );
  });
  it("rejects non-http url", () => {
    expect(
      validateActualSettings({ ...valid, serverUrl: "ftp://x" }),
    ).toHaveProperty("serverUrl");
    expect(
      validateActualSettings({ ...valid, serverUrl: "nope" }),
    ).toHaveProperty("serverUrl");
  });
  it("requires password unless already stored", () => {
    const { serverPassword: _p, ...rest } = valid;
    expect(validateActualSettings(rest)).toHaveProperty("serverPassword");
    expect(validateActualSettings(rest, { ...valid })).toEqual({});
    expect(
      validateActualSettings({ ...valid, serverPassword: "" }),
    ).toHaveProperty("serverPassword");
  });
  it("requires syncId", () => {
    expect(validateActualSettings({ ...valid, syncId: " " })).toHaveProperty(
      "syncId",
    );
  });
});

describe("ActualSettingsStore", () => {
  it("persists, keeps omitted passwords, and uses mode 0600", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ac-")), "n", "a.json");
    const store = new ActualSettingsStore(file);
    expect(store.update(valid)).toEqual({});
    expect(statSync(file).mode & 0o077).toBe(0);

    const again = new ActualSettingsStore(file);
    expect(again.get()).toEqual({
      serverUrl: valid.serverUrl,
      syncId: valid.syncId,
      hasServerPassword: true,
      hasEncryptionPassword: true,
    });
    const { serverPassword: _s, encryptionPassword: _e, ...noPw } = valid;
    expect(again.update({ ...noPw, syncId: "new" })).toEqual({});
    expect(again.getSecret()).toEqual({ ...valid, syncId: "new" });
    again.update({ ...noPw, syncId: "new", encryptionPassword: "" });
    expect(again.get().hasEncryptionPassword).toBe(false);
  });
});

const servers: ReturnType<typeof createServer>["server"][] = [];
async function start() {
  const { server } = createServer({ crawlers: [] });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const put = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", body: JSON.stringify(body) });
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe("actual settings API", () => {
  it("returns empty defaults", async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/settings/actual`)).json()).toEqual({
      serverUrl: "",
      syncId: "",
      hasServerPassword: false,
      hasEncryptionPassword: false,
    });
  });

  it("never leaks passwords", async () => {
    const base = await start();
    expect((await put(`${base}/api/settings/actual`, valid)).status).toBe(200);
    const text = await (await fetch(`${base}/api/settings/actual`)).text();
    expect(text).not.toContain("pw");
    expect(text).not.toContain("e2e");
    expect(JSON.parse(text).hasServerPassword).toBe(true);
  });

  it("rejects invalid PUT without storing", async () => {
    const base = await start();
    const res = await put(`${base}/api/settings/actual`, {
      ...valid,
      syncId: "",
      serverUrl: "ftp://x",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors: Record<string, string> };
    expect(Object.keys(body.errors).sort()).toEqual(["serverUrl", "syncId"]);
    expect(
      (
        (await (await fetch(`${base}/api/settings/actual`)).json()) as {
          serverUrl: string;
        }
      ).serverUrl,
    ).toBe("");
  });

  it("keeps passwords when omitted", async () => {
    const base = await start();
    await put(`${base}/api/settings/actual`, valid);
    const { serverPassword: _s, ...rest } = valid;
    expect((await put(`${base}/api/settings/actual`, rest)).status).toBe(200);
  });
});

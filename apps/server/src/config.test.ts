import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ConfigError,
  resolveActualEnv,
  resolveDataDir,
  resolveLogLevel,
  resolvePort,
} from "./config.js";

describe("resolveDataDir", () => {
  it("defaults to ~/.account-crawler", () => {
    expect(resolveDataDir({}, "/home/u")).toBe("/home/u/.account-crawler");
  });

  it("uses DATA_DIR", () => {
    expect(resolveDataDir({ DATA_DIR: "/data" }, "/home/u")).toBe("/data");
  });

  it("treats an empty DATA_DIR as unset", () => {
    expect(resolveDataDir({ DATA_DIR: "" }, "/home/u")).toBe(
      "/home/u/.account-crawler",
    );
  });

  it("resolves relative paths", () => {
    expect(resolveDataDir({ DATA_DIR: "rel" }, "/h")).toBe(resolve("rel"));
  });
});

describe("resolvePort", () => {
  it("defaults to 0 (random free port)", () => {
    expect(resolvePort({})).toBe(0);
    expect(resolvePort({ PORT: "" })).toBe(0);
  });

  it("uses PORT", () => {
    expect(resolvePort({ PORT: "80" })).toBe(80);
  });

  it("rejects invalid values", () => {
    for (const PORT of ["abc", "-1", "65536", "1.5"]) {
      expect(() => resolvePort({ PORT })).toThrow(ConfigError);
    }
  });
});

describe("resolveActualEnv", () => {
  it("reads all four variables", () => {
    expect(
      resolveActualEnv({
        ACTUAL_SERVER_URL: "https://a.b",
        ACTUAL_SERVER_PASSWORD: "p",
        ACTUAL_SYNC_ID: "s",
        ACTUAL_ENCRYPTION_PASSWORD: "e",
      }),
    ).toEqual({
      serverUrl: "https://a.b",
      serverPassword: "p",
      syncId: "s",
      encryptionPassword: "e",
    });
  });

  it("treats empty as unset and allows partial", () => {
    expect(
      resolveActualEnv({ ACTUAL_SERVER_URL: "http://a", ACTUAL_SYNC_ID: "" }),
    ).toEqual({ serverUrl: "http://a" });
    expect(resolveActualEnv({ ACTUAL_ENCRYPTION_PASSWORD: "" })).toEqual({});
  });

  it("rejects an invalid server URL", () => {
    for (const ACTUAL_SERVER_URL of ["ftp://x", "nope"]) {
      expect(() => resolveActualEnv({ ACTUAL_SERVER_URL })).toThrow(
        ConfigError,
      );
    }
  });
});

describe("resolveLogLevel", () => {
  it("defaults to info", () => {
    expect(resolveLogLevel({})).toBe("info");
    expect(resolveLogLevel({ LOG_LEVEL: "" })).toBe("info");
  });

  it("accepts supported levels case-insensitively", () => {
    expect(resolveLogLevel({ LOG_LEVEL: "DEBUG" })).toBe("debug");
    expect(resolveLogLevel({ LOG_LEVEL: " warn " })).toBe("warn");
    expect(resolveLogLevel({ LOG_LEVEL: "error" })).toBe("error");
  });

  it("rejects unsupported values", () => {
    expect(() => resolveLogLevel({ LOG_LEVEL: "verbose" })).toThrow(
      ConfigError,
    );
  });
});

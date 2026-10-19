import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDataDir, UsageError } from "./cli.js";

describe("resolveDataDir", () => {
  it("defaults to ~/.account-crawler", () => {
    expect(resolveDataDir([], {}, "/home/u")).toBe("/home/u/.account-crawler");
  });

  it("uses the environment variable", () => {
    expect(
      resolveDataDir([], { ACCOUNT_CRAWLER_DATA_DIR: "/env" }, "/home/u"),
    ).toBe("/env");
  });

  it("flag overrides environment", () => {
    const env = { ACCOUNT_CRAWLER_DATA_DIR: "/env" };
    expect(resolveDataDir(["--data-dir", "/tmp/x"], env, "/h")).toBe("/tmp/x");
    expect(resolveDataDir(["--data-dir=/tmp/y"], env, "/h")).toBe("/tmp/y");
  });

  it("resolves relative paths", () => {
    expect(resolveDataDir(["--data-dir", "rel"], {}, "/h")).toBe(
      resolve("rel"),
    );
  });

  it("rejects a missing value", () => {
    expect(() => resolveDataDir(["--data-dir"], {}, "/h")).toThrow(UsageError);
    expect(() => resolveDataDir(["--data-dir="], {}, "/h")).toThrow(UsageError);
  });

  it("rejects unknown arguments", () => {
    expect(() => resolveDataDir(["--nope"], {}, "/h")).toThrow(UsageError);
    expect(() => resolveDataDir(["stray"], {}, "/h")).toThrow(UsageError);
  });
});

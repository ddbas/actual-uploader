import { describe, expect, it } from "vitest";
import { createCapturingLogger } from "./logger.js";

describe("logger", () => {
  it("filters entries below the level", () => {
    const { logger, entries } = createCapturingLogger("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(entries.map((e) => e.msg)).toEqual(["w", "e"]);
  });

  it("outputs all levels at debug", () => {
    const { logger, entries } = createCapturingLogger("debug");
    logger.debug("d");
    logger.info("i");
    expect(entries).toHaveLength(2);
  });

  it("redacts secret fields", () => {
    const { logger, entries } = createCapturingLogger();
    logger.info(
      { serverPassword: "hunter2", settings: { password: "x" } },
      "m",
    );
    expect(JSON.stringify(entries)).not.toContain("hunter2");
    expect(entries[0]?.serverPassword).toBe("***");
  });
});

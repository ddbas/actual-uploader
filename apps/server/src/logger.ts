import { Writable } from "node:stream";
import pino from "pino";
import type { LogLevel } from "./config.js";

export type Logger = pino.Logger;

/** Fields whose values must never reach the logs. */
const REDACT_PATHS = [
  "password",
  "serverPassword",
  "encryptionPassword",
  "*.password",
  "*.serverPassword",
  "*.encryptionPassword",
];

/**
 * Creates the root logger. Output is JSON on standard output only: no file
 * destinations and no transports. Pass `destination` in tests to capture it.
 */
export function createLogger(
  level: LogLevel | "silent",
  destination?: Writable,
): Logger {
  return pino(
    {
      level,
      redact: { paths: REDACT_PATHS, censor: "***" },
      base: undefined,
    },
    destination ?? process.stdout,
  );
}

/** A logger that discards everything. Default for injectable components. */
export const silentLogger: Logger = createLogger("silent");

/** Test helper: a logger capturing parsed entries in memory. */
export function createCapturingLogger(level: LogLevel = "debug") {
  const entries: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) entries.push(JSON.parse(line));
      }
      cb();
    },
  });
  return { logger: createLogger(level, stream), entries };
}

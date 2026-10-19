import { join, resolve } from "node:path";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

/**
 * Resolves the data directory: `DATA_DIR` (empty counts as unset), otherwise
 * `~/.account-crawler`.
 */
export function resolveDataDir(env: Env, home: string): string {
  return resolve(env.DATA_DIR || join(home, ".account-crawler"));
}

/**
 * Resolves the listen port from `PORT`. Unset or empty means `0` (a random
 * free port). Throws a `ConfigError` when the value is not a valid port.
 */
export function resolvePort(env: Env): number {
  if (!env.PORT) return 0;
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ConfigError(`Invalid PORT: ${env.PORT}`);
  }
  return port;
}

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

/**
 * Resolves Actual connection overrides from `ACTUAL_*` variables. Empty counts
 * as unset. Throws a `ConfigError` when `ACTUAL_SERVER_URL` is not http(s).
 */
export function resolveActualEnv(env: Env): {
  serverUrl?: string;
  serverPassword?: string;
  syncId?: string;
  encryptionPassword?: string;
} {
  const out: ReturnType<typeof resolveActualEnv> = {};
  if (env.ACTUAL_SERVER_URL) {
    const url = env.ACTUAL_SERVER_URL.trim();
    let protocol = "";
    try {
      protocol = new URL(url).protocol;
    } catch {}
    if (protocol !== "http:" && protocol !== "https:") {
      throw new ConfigError(
        `Invalid ACTUAL_SERVER_URL: ${env.ACTUAL_SERVER_URL} (must be an http or https URL)`,
      );
    }
    out.serverUrl = url;
  }
  if (env.ACTUAL_SERVER_PASSWORD)
    out.serverPassword = env.ACTUAL_SERVER_PASSWORD;
  if (env.ACTUAL_SYNC_ID) out.syncId = env.ACTUAL_SYNC_ID.trim();
  if (env.ACTUAL_ENCRYPTION_PASSWORD)
    out.encryptionPassword = env.ACTUAL_ENCRYPTION_PASSWORD;
  return out;
}

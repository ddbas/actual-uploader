import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { Account } from "./accounts.js";
import type { ActualSettings } from "./actualSettingsStore.js";
import { type Logger, silentLogger } from "./logger.js";

export interface ImportTransaction {
  account: string;
  date: string;
  [key: string]: unknown;
}

export interface ImportResult {
  added: number;
  updated: number;
}

export interface ActualStatus {
  connected: boolean;
  error?: string;
  /** Seconds until Actual may be contacted again, when rate limited. */
  retryAfterSeconds?: number;
}

/** What the server needs from Actual Budget. Injectable for tests. */
export interface ActualClient {
  getStatus(): Promise<ActualStatus>;
  listAccounts(): Promise<Account[]>;
  importTransactions(transactions: ImportTransaction[]): Promise<ImportResult>;
  /** Discards cached status; call when the Actual settings are saved. */
  invalidate?(): void;
}

/** The subset of `@actual-app/api` that this module uses. */
export interface ActualApi {
  init(config: {
    serverURL: string;
    password: string;
    dataDir: string;
  }): Promise<unknown>;
  downloadBudget(
    syncId: string,
    options?: { password?: string },
  ): Promise<void>;
  getAccounts(): Promise<{ id: string; name: string }[]>;
  importTransactions(
    accountId: string,
    transactions: ImportTransaction[],
  ): Promise<{
    added: unknown[];
    updated: unknown[];
    errors?: { message: string }[];
  }>;
  sync(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ActualClientOptions {
  /** Read at the time of each operation so settings changes apply live. */
  getSettings: () => ActualSettings;
  /** Directory where Actual stores its local budget cache. */
  dataDir: string;
  /** Loads the Actual API. Defaults to a lazy import of `@actual-app/api`. */
  loadApi?: () => Promise<ActualApi>;
  /** Timeout for status checks and account listing. Default 15s. */
  timeoutMs?: number;
  /** Timeout for imports. Default 120s. */
  importTimeoutMs?: number;
  /** Close the session after this long without use. Default 5 min. */
  idleTimeoutMs?: number;
  /** How long a status result is reused. Default 15s. */
  statusCacheMs?: number;
  /** Cooldown after Actual rate-limits logins. Default 60s. */
  backoffMs?: number;
  /** Logger. Defaults to a silent one. */
  logger?: Logger;
}

export class ActualConnectionError extends Error {}

/** Actual rejected logins as too frequent; no requests are made until the cooldown ends. */
export class ActualRateLimitError extends ActualConnectionError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Actual is rate-limiting logins; retrying in ${retryAfterSeconds} s.`,
    );
  }
}

function isRateLimit(error: unknown): boolean {
  if (error instanceof ActualRateLimitError) return true;
  const e = error as { code?: unknown; reason?: unknown; message?: unknown };
  return (
    e?.code === "too-many-requests" ||
    e?.reason === "too-many-requests" ||
    (typeof e?.message === "string" && e.message.includes("too-many-requests"))
  );
}

function settingsKey(s: ActualSettings): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        s.serverUrl,
        s.serverPassword,
        s.syncId,
        s.encryptionPassword,
      ]),
    )
    .digest("hex");
}

const defaultLoadApi = async (): Promise<ActualApi> =>
  (await import("@actual-app/api")) as unknown as ActualApi;

/** Message safe to show to the user: never contains any stored secret. */
export function sanitizeError(error: unknown, settings: ActualSettings) {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  if (!message) message = "Unknown error";
  for (const secret of [settings.serverPassword, settings.encryptionPassword]) {
    if (secret) message = message.split(secret).join("***");
  }
  return message;
}

function redact(text: string, settings: ActualSettings): string {
  let out = text;
  for (const secret of [settings.serverPassword, settings.encryptionPassword]) {
    if (secret) out = out.split(secret).join("***");
  }
  return out;
}

/**
 * Secret-free diagnostic details of an error for the logs: name, code, syscall,
 * host, stack, and the `cause` chain (network and TLS errors usually hide the
 * real reason there). Non-Error values such as `{ reason }` are serialized.
 */
export function describeError(
  error: unknown,
  settings: ActualSettings,
  depth = 0,
): Record<string, unknown> {
  if (!(error instanceof Error)) {
    let text: string;
    try {
      text = typeof error === "string" ? error : JSON.stringify(error);
    } catch {
      text = String(error);
    }
    return { value: redact(text ?? "undefined", settings) };
  }
  const e = error as Error & Record<string, unknown>;
  const out: Record<string, unknown> = {
    name: e.name,
    message: redact(e.message, settings),
  };
  for (const key of [
    "code",
    "errno",
    "syscall",
    "hostname",
    "address",
    "port",
  ]) {
    if (e[key] !== undefined) out[key] = e[key];
  }
  if (e.stack) out.stack = redact(e.stack, settings);
  if (e.cause !== undefined && depth < 3) {
    out.cause = describeError(e.cause, settings, depth + 1);
  }
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ActualConnectionError("Timed out connecting to Actual")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Creates the real Actual client. The API session stays open between
 * operations and is reused while the settings are unchanged; it is dropped on
 * failure, when settings change, and after an idle period. Operations are
 * serialized because `@actual-app/api` holds a single open budget per process.
 * Logins are rate-limited per IP by Actual, so after `too-many-requests` no
 * requests are made for a cooldown.
 */
export function createActualClient(options: ActualClientOptions): ActualClient {
  const loadApi = options.loadApi ?? defaultLoadApi;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const importTimeoutMs = options.importTimeoutMs ?? 120_000;
  const idleTimeoutMs = options.idleTimeoutMs ?? 300_000;
  const statusCacheMs = options.statusCacheMs ?? 15_000;
  const backoffMs = options.backoffMs ?? 60_000;
  const log = options.logger ?? silentLogger;
  let queue: Promise<unknown> = Promise.resolve();
  let session: { api: ActualApi; key: string } | undefined;
  let idleTimer: NodeJS.Timeout | undefined;
  let blockedUntil = 0;
  let statusCache:
    | { key: string; until: number; value: ActualStatus }
    | undefined;

  const enqueue = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  };

  async function shutdownApi(
    api: ActualApi,
    operation: string,
    settings: ActualSettings,
  ) {
    await api.shutdown().catch((error) => {
      log.warn(
        { operation, error: describeError(error, settings) },
        `Actual shutdown failed: ${sanitizeError(error, settings)}`,
      );
    });
  }

  async function closeSession(operation: string, settings: ActualSettings) {
    clearTimeout(idleTimer);
    const old = session;
    session = undefined;
    if (old) await shutdownApi(old.api, operation, settings);
  }

  function armIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      void enqueue(async () => {
        log.debug("Actual session idle; closing");
        await closeSession("idle", options.getSettings());
      });
    }, idleTimeoutMs);
    idleTimer.unref?.();
  }

  function withActual<T>(
    operation: string,
    fn: (api: ActualApi) => Promise<T>,
    ms: number,
    retryFresh = true,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const settings = options.getSettings();
      const started = Date.now();
      if (!settings.serverUrl || !settings.serverPassword || !settings.syncId) {
        log.warn({ operation }, "Actual settings are incomplete");
        throw new ActualConnectionError("Actual settings are incomplete");
      }
      const key = settingsKey(settings);
      if (session && session.key !== key) {
        log.debug({ operation }, "Actual settings changed; closing session");
        await closeSession(operation, settings);
      }

      const attempt = async (): Promise<{ value: T; reused: boolean }> => {
        const now = Date.now();
        if (blockedUntil > now) {
          throw new ActualRateLimitError(
            Math.ceil((blockedUntil - now) / 1000),
          );
        }
        const reused = !!session;
        let phase = reused ? "operation" : "load-api";
        const phaseStarted: Record<string, number> = {};
        const step = async <R>(name: string, work: () => Promise<R>) => {
          phase = name;
          const t = Date.now();
          log.debug({ operation, phase: name }, `Actual: ${name} started`);
          const result = await work();
          phaseStarted[name] = Date.now() - t;
          log.debug(
            { operation, phase: name, durationMs: phaseStarted[name] },
            `Actual: ${name} done`,
          );
          return result;
        };
        log.debug(
          {
            operation,
            reused,
            serverUrl: settings.serverUrl,
            syncId: settings.syncId,
            hasEncryptionPassword: !!settings.encryptionPassword,
            dataDir: options.dataDir,
            timeoutMs: ms,
            tlsVerificationDisabled:
              process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0",
          },
          "Actual operation started",
        );
        clearTimeout(idleTimer);
        let opened: ActualApi | undefined;
        let abandoned = false;
        try {
          const value = await withTimeout(
            (async () => {
              let api = session?.api;
              if (!api) {
                mkdirSync(options.dataDir, { recursive: true });
                const loaded = await step("load-api", loadApi);
                opened = loaded;
                await step("init", () =>
                  loaded.init({
                    serverURL: settings.serverUrl,
                    password: settings.serverPassword,
                    dataDir: options.dataDir,
                  }),
                );
                await step("download-budget", () =>
                  loaded.downloadBudget(
                    settings.syncId,
                    settings.encryptionPassword
                      ? { password: settings.encryptionPassword }
                      : undefined,
                  ),
                );
                if (abandoned) {
                  // The timeout handler already shut this API down.
                  throw new ActualConnectionError("Abandoned after timeout");
                }
                session = { api: loaded, key };
                opened = undefined;
                api = loaded;
              }
              const current = api;
              const result = await step("operation", () => fn(current));
              log.debug(
                {
                  operation,
                  durationMs: Date.now() - started,
                  phases: phaseStarted,
                },
                "Actual operation finished",
              );
              return result;
            })(),
            ms,
          );
          armIdleTimer();
          return { value, reused };
        } catch (error) {
          abandoned = true;
          const rateLimited = isRateLimit(error);
          const message = sanitizeError(error, settings);
          log.warn(
            {
              operation,
              phase,
              reused,
              serverUrl: settings.serverUrl,
              durationMs: Date.now() - started,
              phases: phaseStarted,
              timedOut: error instanceof ActualConnectionError,
              error: describeError(error, settings),
            },
            `Actual operation failed during ${phase}: ${message}`,
          );
          await closeSession(operation, settings);
          if (opened) {
            // Session never stored (failed while opening): shut it down.
            await shutdownApi(opened, operation, settings);
          }
          if (rateLimited) {
            if (!(error instanceof ActualRateLimitError)) {
              blockedUntil = Date.now() + backoffMs;
              throw new ActualRateLimitError(Math.ceil(backoffMs / 1000));
            }
            throw error;
          }
          throw Object.assign(new ActualConnectionError(message), { reused });
        }
      };

      try {
        return (await attempt()).value;
      } catch (error) {
        const failedReused = (error as { reused?: boolean }).reused === true;
        const timedOut =
          error instanceof ActualConnectionError &&
          error.message === "Timed out connecting to Actual";
        if (!(retryFresh && failedReused && !timedOut)) throw error;
        log.info({ operation }, "Reused Actual session failed; retrying fresh");
        return (await attempt()).value;
      }
    };
    return enqueue(run);
  }

  async function checkStatus(): Promise<ActualStatus> {
    try {
      await withActual("status", async () => {}, timeoutMs);
      log.debug("Actual status: connected");
      return { connected: true };
    } catch (error) {
      const status: ActualStatus = {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      if (error instanceof ActualRateLimitError) {
        status.retryAfterSeconds = error.retryAfterSeconds;
      }
      return status;
    }
  }

  return {
    async getStatus() {
      const key = settingsKey(options.getSettings());
      if (
        statusCache &&
        statusCache.key === key &&
        statusCache.until > Date.now()
      ) {
        return statusCache.value;
      }
      const value = await checkStatus();
      // Rate-limit answers carry a moving countdown and cost nothing to recompute.
      statusCache =
        value.retryAfterSeconds === undefined
          ? { key, until: Date.now() + statusCacheMs, value }
          : undefined;
      return value;
    },
    invalidate() {
      statusCache = undefined;
    },
    listAccounts() {
      return withActual(
        "accounts",
        async (api) => {
          try {
            await api.sync();
          } catch (error) {
            if (isRateLimit(error)) throw error;
            const settings = options.getSettings();
            log.warn(
              { error: describeError(error, settings) },
              `Actual sync before listing accounts failed: ${sanitizeError(error, settings)}`,
            );
          }
          const accounts = (await api.getAccounts()).map(({ id, name }) => ({
            id,
            name,
          }));
          log.info({ count: accounts.length }, "Listed Actual accounts");
          return accounts;
        },
        timeoutMs,
      );
    },
    importTransactions(transactions) {
      return withActual(
        "import",
        async (api) => {
          const byAccount = new Map<string, ImportTransaction[]>();
          for (const t of transactions) {
            byAccount.set(t.account, [...(byAccount.get(t.account) ?? []), t]);
          }
          let added = 0;
          let updated = 0;
          for (const [account, txs] of byAccount) {
            const result = await api.importTransactions(account, txs);
            if (result.errors?.length) {
              throw new Error(result.errors.map((e) => e.message).join("; "));
            }
            added += result.added.length;
            updated += result.updated.length;
          }
          await api.sync();
          log.info(
            { added, updated, accounts: byAccount.size },
            "Imported transactions into Actual",
          );
          return { added, updated };
        },
        importTimeoutMs,
        false,
      );
    },
  };
}

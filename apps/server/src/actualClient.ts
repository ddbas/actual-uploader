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
}

/** What the server needs from Actual Budget. Injectable for tests. */
export interface ActualClient {
  getStatus(): Promise<ActualStatus>;
  listAccounts(): Promise<Account[]>;
  importTransactions(transactions: ImportTransaction[]): Promise<ImportResult>;
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
  /** Logger. Defaults to a silent one. */
  logger?: Logger;
}

export class ActualConnectionError extends Error {}

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
 * Creates the real Actual client. Each operation opens the budget with the
 * current settings, runs, and shuts the API down. Operations are serialized
 * because `@actual-app/api` holds a single open budget per process.
 */
export function createActualClient(options: ActualClientOptions): ActualClient {
  const loadApi = options.loadApi ?? defaultLoadApi;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const importTimeoutMs = options.importTimeoutMs ?? 120_000;
  const log = options.logger ?? silentLogger;
  let queue: Promise<unknown> = Promise.resolve();

  function withActual<T>(
    operation: string,
    fn: (api: ActualApi) => Promise<T>,
    ms: number,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const settings = options.getSettings();
      const started = Date.now();
      if (!settings.serverUrl || !settings.serverPassword || !settings.syncId) {
        log.warn({ operation }, "Actual settings are incomplete");
        throw new ActualConnectionError("Actual settings are incomplete");
      }
      let api: ActualApi | undefined;
      let phase = "load-api";
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
      try {
        return await withTimeout(
          (async () => {
            mkdirSync(options.dataDir, { recursive: true });
            const loaded = await step("load-api", loadApi);
            api = loaded;
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
            const value = await step("operation", () => fn(loaded));
            log.debug(
              {
                operation,
                durationMs: Date.now() - started,
                phases: phaseStarted,
              },
              "Actual operation finished",
            );
            return value;
          })(),
          ms,
        );
      } catch (error) {
        const message = sanitizeError(error, settings);
        log.warn(
          {
            operation,
            phase,
            serverUrl: settings.serverUrl,
            durationMs: Date.now() - started,
            phases: phaseStarted,
            timedOut: error instanceof ActualConnectionError,
            error: describeError(error, settings),
          },
          `Actual operation failed during ${phase}: ${message}`,
        );
        throw new ActualConnectionError(message);
      } finally {
        await api?.shutdown().catch((error) => {
          log.warn(
            { operation, error: describeError(error, settings) },
            `Actual shutdown failed: ${sanitizeError(error, settings)}`,
          );
        });
      }
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  return {
    async getStatus() {
      try {
        await withActual("status", async () => {}, timeoutMs);
        log.debug("Actual status: connected");
        return { connected: true };
      } catch (error) {
        return {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    listAccounts() {
      return withActual(
        "accounts",
        async (api) => {
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
      );
    },
  };
}

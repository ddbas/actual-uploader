import { mkdirSync } from "node:fs";
import type { Account } from "./accounts.js";
import type { ActualSettings } from "./actualSettingsStore.js";

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
  let queue: Promise<unknown> = Promise.resolve();

  function withActual<T>(
    fn: (api: ActualApi) => Promise<T>,
    ms: number,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const settings = options.getSettings();
      if (!settings.serverUrl || !settings.serverPassword || !settings.syncId) {
        throw new ActualConnectionError("Actual settings are incomplete");
      }
      let api: ActualApi | undefined;
      try {
        return await withTimeout(
          (async () => {
            mkdirSync(options.dataDir, { recursive: true });
            api = await loadApi();
            await api.init({
              serverURL: settings.serverUrl,
              password: settings.serverPassword,
              dataDir: options.dataDir,
            });
            await api.downloadBudget(
              settings.syncId,
              settings.encryptionPassword
                ? { password: settings.encryptionPassword }
                : undefined,
            );
            return fn(api);
          })(),
          ms,
        );
      } catch (error) {
        throw new ActualConnectionError(sanitizeError(error, settings));
      } finally {
        await api?.shutdown().catch(() => {});
      }
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  return {
    async getStatus() {
      try {
        await withActual(async () => {}, timeoutMs);
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
        async (api) =>
          (await api.getAccounts()).map(({ id, name }) => ({ id, name })),
        timeoutMs,
      );
    },
    importTransactions(transactions) {
      return withActual(async (api) => {
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
        return { added, updated };
      }, importTimeoutMs);
    },
  };
}

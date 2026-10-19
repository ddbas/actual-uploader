import type { Source, SourceDraft } from "statement-core";
import type { Transaction } from "./types.js";

export async function fetchSources(): Promise<Source[]> {
  const res = await fetch("/api/sources");
  if (!res.ok) {
    throw new Error("Failed to fetch sources");
  }
  return res.json();
}

export async function createSource(draft: SourceDraft): Promise<Source> {
  const res = await fetch("/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
    throw new Error(body.errors?.join(", ") ?? "Failed to save source");
  }
  return res.json();
}

export async function deleteSource(id: string): Promise<void> {
  await fetch(`/api/sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface ProcessedFile {
  transactions: Transaction[];
  errors: { row: number; message: string }[];
}

export async function processStatement(
  sourceId: string,
  account: string,
  content: string,
): Promise<ProcessedFile> {
  const res = await fetch(
    `/api/sources/${encodeURIComponent(sourceId)}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, content }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to process file");
  }
  return res.json();
}

/** An Actual Budget account: `id` is sent as the transaction's account. */
export interface Account {
  id: string;
  name: string;
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch("/api/accounts");
  if (!res.ok) {
    throw new Error("Failed to fetch accounts");
  }
  return res.json();
}

export interface ActualSettingsView {
  serverUrl: string;
  syncId: string;
  hasServerPassword: boolean;
  hasEncryptionPassword: boolean;
}

export interface ActualSettingsUpdate {
  serverUrl: string;
  syncId: string;
  serverPassword?: string;
  encryptionPassword?: string;
}

export class SettingsValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Invalid settings");
  }
}

export async function fetchActualSettings(): Promise<ActualSettingsView> {
  const res = await fetch("/api/settings/actual");
  if (!res.ok) {
    throw new Error("Failed to fetch settings");
  }
  return res.json();
}

export async function saveActualSettings(
  update: ActualSettingsUpdate,
): Promise<ActualSettingsView> {
  const res = await fetch("/api/settings/actual", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as {
      errors?: Record<string, string>;
    };
    throw new SettingsValidationError(body.errors ?? {});
  }
  if (!res.ok) {
    throw new Error("Failed to save settings");
  }
  return res.json();
}

export interface ActualStatus {
  connected: boolean;
  error?: string;
}

export async function fetchActualStatus(): Promise<ActualStatus> {
  try {
    const res = await fetch("/api/actual/status");
    if (!res.ok) {
      return { connected: false, error: "Failed to check connection" };
    }
    return await res.json();
  } catch {
    return { connected: false, error: "Server is unreachable" };
  }
}

export interface ImportResult {
  added: number;
  updated: number;
}

export async function importTransactions(
  transactions: Transaction[],
): Promise<ImportResult> {
  const res = await fetch("/api/actual/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to upload transactions");
  }
  return res.json();
}

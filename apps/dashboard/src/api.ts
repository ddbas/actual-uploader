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

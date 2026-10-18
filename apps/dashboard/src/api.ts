import type { Source, SourceDraft } from "statement-core";
import type { CrawlerSummary } from "./serverTypes.js";

export async function fetchCrawlers(): Promise<CrawlerSummary[]> {
  const res = await fetch("/api/crawlers");
  if (!res.ok) {
    throw new Error("Failed to fetch crawlers");
  }
  return res.json();
}

export async function runCrawler(id: string): Promise<void> {
  await fetch(`/api/crawlers/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
}

export async function runAllCrawlers(): Promise<void> {
  await fetch("/api/run-all", { method: "POST" });
}

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

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

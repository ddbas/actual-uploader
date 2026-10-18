import type { UploadType, UploadTypeDraft } from "statement-core";
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

export async function fetchUploadTypes(): Promise<UploadType[]> {
  const res = await fetch("/api/upload-types");
  if (!res.ok) {
    throw new Error("Failed to fetch upload types");
  }
  return res.json();
}

export async function createUploadType(
  draft: UploadTypeDraft,
): Promise<UploadType> {
  const res = await fetch("/api/upload-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { errors?: string[] };
    throw new Error(body.errors?.join(", ") ?? "Failed to save upload type");
  }
  return res.json();
}

export async function deleteUploadType(id: string): Promise<void> {
  await fetch(`/api/upload-types/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

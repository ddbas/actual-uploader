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

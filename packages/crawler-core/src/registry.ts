import type { Crawler } from "./crawler.js";

const registry = new Map<string, Crawler>();

/**
 * Registers a crawler so it can be discovered via {@link getCrawlers} and
 * {@link getCrawler}. Throws if a crawler with the same `id` is already
 * registered.
 */
export function registerCrawler(crawler: Crawler): void {
  if (registry.has(crawler.id)) {
    throw new Error(`A crawler with id "${crawler.id}" is already registered.`);
  }
  registry.set(crawler.id, crawler);
}

/** Returns every registered crawler, without invoking `run` on any of them. */
export function getCrawlers(): Crawler[] {
  return Array.from(registry.values());
}

/** Returns a single registered crawler by id, or `undefined` if not found. */
export function getCrawler(id: string): Crawler | undefined {
  return registry.get(id);
}

/** Removes every registered crawler. Intended for test isolation. */
export function clearCrawlerRegistry(): void {
  registry.clear();
}

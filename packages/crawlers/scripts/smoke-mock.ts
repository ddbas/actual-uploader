/**
 * Manual/opt-in smoke test for the mock crawler.
 *
 * Runs the mock crawler against the real Desjardins authentication URL using
 * a real Playwright browser. Not part of the default `vitest run` suite —
 * invoke explicitly with `pnpm --filter crawlers test:smoke`.
 */
import { mockCrawler } from "../src/mock.js";

async function main() {
  console.log(`Running smoke test for crawler "${mockCrawler.id}"...`);
  let count = 0;
  for await (const transaction of mockCrawler.run()) {
    count += 1;
    console.log("Yielded transaction:", transaction);
  }
  console.log(`Done. Received ${count} transaction(s).`);
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exitCode = 1;
});

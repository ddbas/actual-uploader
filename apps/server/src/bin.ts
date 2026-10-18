#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "crawlers";
import { getCrawlers } from "crawler-core";
import open from "open";
import { createServer } from "./server.js";
import { UploadTypeStore } from "./uploadTypeStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const staticDir = join(__dirname, "..", "..", "dashboard", "dist");
  const dataDir =
    process.env.ACCOUNT_CRAWLER_DATA_DIR ?? join(homedir(), ".account-crawler");
  const { server } = createServer({
    crawlers: getCrawlers(),
    uploadTypes: new UploadTypeStore(join(dataDir, "upload-types.json")),
    staticDir: existsSync(staticDir) ? staticDir : undefined,
  });

  const port = Number(process.env.PORT ?? 0);

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : port;
  const url = `http://127.0.0.1:${resolvedPort}`;

  console.log(`Account Crawler dashboard running at ${url}`);

  if (!process.env.ACCOUNT_CRAWLER_NO_OPEN) {
    await open(url);
  }
}

main().catch((error) => {
  console.error("Failed to start Account Crawler:", error);
  process.exitCode = 1;
});

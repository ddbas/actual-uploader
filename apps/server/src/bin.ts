#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { ActualSettingsStore } from "./actualSettingsStore.js";
import { resolveDataDir, USAGE, UsageError } from "./cli.js";
import { createServer } from "./server.js";
import { SourceStore } from "./sourceStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// TODO: Temporary. Disables TLS certificate verification for ALL outgoing
// connections so we can reach Actual servers using a private/self-signed CA.
// Replace with proper CA trust (NODE_EXTRA_CA_CERTS or a setting) later.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  let dataDir: string;
  try {
    dataDir = resolveDataDir(process.argv.slice(2), process.env, homedir());
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n\n${USAGE}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  console.warn(
    "WARNING: TLS certificate verification is disabled (temporary).",
  );
  const staticDir = join(__dirname, "..", "..", "dashboard", "dist");
  const { server } = createServer({
    sources: new SourceStore(join(dataDir, "sources.json")),
    actualSettings: new ActualSettingsStore(
      join(dataDir, "actual-settings.json"),
    ),
    actualDataDir: join(dataDir, "actual-cache"),
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

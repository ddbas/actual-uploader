#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { ActualSettingsStore } from "./actualSettingsStore.js";
import { ConfigError, resolveDataDir, resolvePort } from "./config.js";
import { createServer } from "./server.js";
import { SourceStore } from "./sourceStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// TODO: Temporary. Disables TLS certificate verification for ALL outgoing
// connections so we can reach Actual servers using a private/self-signed CA.
// Replace with proper CA trust (NODE_EXTRA_CA_CERTS or a setting) later.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  let dataDir: string;
  let port: number;
  try {
    dataDir = resolveDataDir(process.env, homedir());
    port = resolvePort(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Error: ${error.message}`);
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

  // Containers must set HOST=0.0.0.0 so the published port is reachable.
  const host = process.env.HOST ?? "127.0.0.1";

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : port;
  const url = `http://${host}:${resolvedPort}`;

  console.log(`Account Crawler dashboard running at ${url}`);

  if (!process.env.ACCOUNT_CRAWLER_NO_OPEN) {
    await open(url);
  }
}

main().catch((error) => {
  console.error("Failed to start Account Crawler:", error);
  process.exitCode = 1;
});

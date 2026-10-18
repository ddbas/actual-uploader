/**
 * `crawler:generate <name> <url>`: records a browsing session with Playwright
 * codegen and scaffolds a registered crawler from it.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseArgs,
  registerInIndex,
  renderBanner,
  renderCrawler,
  USAGE,
} from "./generate-lib.js";
import { record } from "./record.js";
import { sanitize } from "./sanitize.js";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(packageDir, "..", "..");

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`${parsed.error}\n\n${USAGE}`);
    return 1;
  }
  const { name, url } = parsed.args;

  console.log(`\n${renderBanner()}\n`);

  const tmp = mkdtempSync(join(tmpdir(), "crawler-generate-"));
  const outputFile = join(tmp, "recording.js");
  let recording = "";
  try {
    await record(url, outputFile);
    if (existsSync(outputFile)) {
      recording = readFileSync(outputFile, "utf8");
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const { steps, warnings, recordedStepCount } = sanitize(recording);

  if (recordedStepCount === 0) {
    if (recording.trim() !== "" && steps.length === 0) {
      console.error(
        "Recording had no recognizable page steps (did the codegen output format change?). Nothing was written.",
      );
      return 1;
    }
    console.log("Nothing was recorded; no crawler was created.");
    return 0;
  }

  const crawlerPath = join(packageDir, "src", `${name}.ts`);
  const indexPath = join(packageDir, "src", "index.ts");
  writeFileSync(crawlerPath, renderCrawler({ name, url, steps }));
  writeFileSync(
    indexPath,
    registerInIndex(readFileSync(indexPath, "utf8"), name),
  );

  // Best-effort formatting so the output passes Biome.
  spawnSync(
    "pnpm",
    ["exec", "biome", "check", "--write", crawlerPath, indexPath],
    { cwd: repoRoot, stdio: "ignore" },
  );

  console.log(`Crawler written to ${crawlerPath}`);
  console.log(`Registered in ${indexPath}`);
  for (const warning of warnings) {
    console.warn(`WARNING: ${warning}`);
  }
  console.log(
    "Review the generated file, then implement the transaction extraction TODO.",
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error("Generation failed:", error);
    process.exitCode = 1;
  },
);

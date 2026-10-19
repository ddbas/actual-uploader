import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

export const USAGE = `Usage: account-crawler [--data-dir <path>]

Options:
  --data-dir <path>  Directory for persisted data. Overrides
                     ACCOUNT_CRAWLER_DATA_DIR (default: ~/.account-crawler)`;

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/**
 * Resolves the data directory: `--data-dir`, then `ACCOUNT_CRAWLER_DATA_DIR`,
 * then `~/.account-crawler`. Throws a `UsageError` on invalid arguments.
 */
export function resolveDataDir(
  args: string[],
  env: Record<string, string | undefined>,
  home: string,
): string {
  let values: { "data-dir"?: string };
  try {
    ({ values } = parseArgs({
      args,
      options: { "data-dir": { type: "string" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new UsageError(
      error instanceof Error ? error.message : String(error),
    );
  }

  const flag = values["data-dir"];
  if (flag !== undefined) {
    if (flag === "") throw new UsageError("--data-dir requires a value");
    return resolve(flag);
  }
  return resolve(
    env.ACCOUNT_CRAWLER_DATA_DIR ?? join(home, ".account-crawler"),
  );
}

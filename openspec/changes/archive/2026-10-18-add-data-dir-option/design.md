## Context

`apps/server/src/bin.ts` computes the data directory inline from
`ACCOUNT_CRAWLER_DATA_DIR` or `~/.account-crawler` and passes derived paths to
`SourceStore`, `ActualSettingsStore` and the Actual cache. See proposal.md for
motivation.

## Goals / Non-Goals

**Goals:**

- Add `--data-dir <path>` with precedence over the env var.
- Keep argument parsing unit-testable without launching the server.

**Non-Goals:**

- Other CLI options (port, no-open) and a CLI framework.
- Migrating existing data when the directory changes.

## Decisions

- **Use Node's built-in `util.parseArgs`** (strict mode) rather than adding a
  dependency such as commander. Only one option exists; strict mode gives errors
  for unknown arguments and missing values for free.
- **Extract a pure `resolveDataDir(args, env, home)` function** into
  `apps/server/src/cli.ts`, returning the directory or throwing a usage error.
  `bin.ts` calls it and handles errors by printing and setting
  `process.exitCode = 1`. Alternative: inline in `bin.ts`, rejected since
  `bin.ts` runs `main()` on import and is hard to test.
- **Resolve the path to absolute** with `path.resolve` so relative paths behave
  predictably regardless of later cwd changes.
- **Accept `--data-dir=<path>` and `--data-dir <path>`**, both supported by
  `parseArgs`.

## Risks / Trade-offs

- [Empty string value, e.g. `--data-dir=`] → treat as missing value and error.
- [Relative path surprises] → resolved against the cwd at startup.

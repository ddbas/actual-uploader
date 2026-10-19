## Why

The server binary stores all persisted data (sources, Actual settings, Actual
cache) in a data directory that can only be overridden through the
`ACCOUNT_CRAWLER_DATA_DIR` environment variable. A command-line option is more
discoverable and convenient for running multiple instances or pointing at a
different "database" location ad hoc.

## What Changes

- The `account-crawler` binary accepts an optional `--data-dir <path>` option
  that overrides the location of the data directory.
- Resolution order: `--data-dir`, then `ACCOUNT_CRAWLER_DATA_DIR`, then
  `~/.account-crawler`.
- `--data-dir` without a value is rejected with a clear error and a non-zero
  exit code.
- Unknown arguments are rejected with a usage message.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-settings-technical`: the data directory requirement gains a CLI
  override with defined precedence.

## Impact

- `apps/server/src/bin.ts`: argument parsing and data directory resolution.
- No API, dependency, or dashboard changes.

## Why

The server has no logging beyond a few `console` calls at startup. Request
handling, Actual Budget connection attempts, imports, and failures leave no
trace, so operators (especially in containers) cannot diagnose problems.

## What Changes

- Add [pino](https://getpino.io) as the server's structured logger, writing to
  the console (stdout) only. No file transports or log files.
- Add a `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`)
  controlling verbosity; default `info`. Invalid values fail startup with a
  clear config error, like `PORT`.
- Replace the `console.*` calls in `bin.ts` with the logger.
- Add log statements at `debug`, `info`, `warn`, and `error` levels where useful
  across the server: HTTP requests/responses, source CRUD, statement processing,
  Actual connection/status/account/import operations, settings load/save, and
  config/startup/shutdown.
- Never log secrets (Actual server password, encryption password) or statement
  contents/transaction data; sensitive fields are redacted.
- Log errors that are currently swallowed (500/502 handlers, settings file read
  failures, Actual API shutdown failures).

## Capabilities

### New Capabilities

- `server-logging-technical`: Server logging behavior: console-only structured
  output, `LOG_LEVEL` control, level semantics, coverage of key server events,
  and secret/data redaction.

### Modified Capabilities

## Impact

- `apps/server`: new `logger.ts`, `config.ts` (`resolveLogLevel`), `bin.ts`,
  `server.ts`, `actualClient.ts`, `actualSettingsStore.ts`, `sourceStore.ts`.
- New dependency: `pino` in `apps/server/package.json` (and optionally
  `pino-pretty` as a dev-only convenience, not used in production).
- Docs: README documents `LOG_LEVEL`. Container deployments get logs via stdout
  with no config change.
- Tests: injectable logger so existing tests stay quiet and can assert on logs.

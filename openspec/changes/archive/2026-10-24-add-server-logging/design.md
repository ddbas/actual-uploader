## Context

The server (`apps/server`) is a plain `node:http` server with no logger; only
`bin.ts` uses `console`. Several errors are swallowed or only returned to the
client (the `.catch(() => 500)` handlers, `ActualSettingsStore` read failures,
`api.shutdown().catch(() => {})`). `actualClient.ts` already has `sanitizeError`
for stripping secrets. Config is resolved from env in `config.ts` (`ConfigError`
on invalid values). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- One structured logger, injectable so tests stay quiet and can assert on
  output.
- Level from `LOG_LEVEL`, validated like other config.
- Meaningful coverage at all four levels, without leaking secrets or data.

**Non-Goals:**

- File logging, log rotation, remote transports.
- Frontend (dashboard) logging.
- Metrics or tracing.
- Changing API responses or error messages.

## Decisions

**Pino, JSON to stdout by default.** Matches the request, is fast, and JSON on
stdout suits containers. Alternative: winston/console wrapper: heavier or less
structured. No `transport` is configured, so pino writes synchronously to
`process.stdout`; this guarantees console-only output.

**Human-readable dev output is opt-out of the app.** `pino-pretty` is not a
runtime dependency. Developers can pipe (`| pino-pretty`) if wanted; documented
in README. Keeps the production path simple and avoids a worker-thread
transport.

**`logger.ts` exports `createLogger(level)` and a `Logger` type.** `bin.ts`
creates the root logger; `createServer` and `createActualClient` accept an
optional `logger` option and create child loggers (`{ component: "http" }`,
`"actual"`, `"settings"`, `"sources"`). Default is a silent logger
(`level: "silent"`) so existing tests are unchanged and library-style use
doesn't spam. Alternative: a module-level singleton: simpler but harder to test
and to scope per component.

**`resolveLogLevel(env)` in `config.ts`.** Lowercases, trims, empty means
`info`, throws `ConfigError("Invalid LOG_LEVEL: ...")` otherwise. Supported:
`debug|info|warn|error` only (not `trace`/`fatal`/`silent`) to match the spec.
Config errors happen before a logger exists, so that path still uses
`console.error` for the fatal message; everything after uses the logger.

**Request logging in one place.** Wrap the `createHttpServer` handler: record
start time, and on `res` `finish` log `{ method, path, status, durationMs }` at
`debug` for successful requests and static assets, `info` for API calls
(configurable by level choice below), `warn` for 4xx, `error` for 5xx. Path
only, no query string or body. Static file requests log at `debug` to avoid
noise.

**Level mapping:**

- `debug`: request details, static files, Actual operation steps (init,
  download, sync, shutdown), settings loaded, process-result counts.
- `info`: startup/listening address/effective level, source add/remove, settings
  updated (field names), Actual status/account/import success with counts and
  duration.
- `warn`: 4xx responses, incomplete Actual settings, Actual connection or import
  failure (sanitized), incomplete or failing connection details.
- `error`: unreadable/unwritable settings or sources file (rethrown, existing
  behavior unchanged), 5xx from unexpected exceptions (with stack), startup
  failure, TLS-verification-disabled notice stays `warn`.

**Redaction.** Two layers: (1) never pass bodies, content, or transactions to
the logger (only counts/ids); (2) pino `redact` for paths such as
`serverPassword`, `encryptionPassword`, `password`, `*.password` as a safety
net; (3) errors logged from Actual go through `sanitizeError` before logging.
The settings store logs changed field names only.

**Actual connection diagnostics.** The Actual client tracks the current phase
(`load-api`, `init`, `download-budget`, `operation`), logs each phase start/end
with timings at `debug`, and on failure logs a `warn` with the failing phase,
server URL, elapsed time, and a secret-redacted error description (name, code,
syscall, host, stack, `cause` chain). Timeouts report which phase hung.

**Swallowed errors get logged, behavior unchanged.** The 500 handlers log
`error` with `err`; `shutdown().catch` logs `warn`; behavior and responses stay
identical.

## Risks / Trade-offs

- [Secret leakage through error objects] → Sanitize before logging, redact
  paths, and add tests with a stored password in an error message.
- [Log noise from dashboard polling `/api/actual/status`] → Request logs for
  successful GETs at `debug`; mutating calls and failures at `info`+.
- [Synchronous stdout writes could block under heavy output] → Acceptable for a
  single-user local tool; volume is low.
- [Statement filenames/ids might be sensitive] → Log source ids only, never
  filenames or contents.

## Migration Plan

Additive. Default level `info` produces modest output. Rollback is reverting the
change; no data or API changes.

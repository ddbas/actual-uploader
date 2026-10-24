## 1. Logger Foundation

- [x] 1.1 Add `pino` to `apps/server` and verify `mise run` install succeeds and
      the lockfile updates
- [x] 1.2 Add `resolveLogLevel` to `apps/server/src/config.ts` (default `info`,
      case-insensitive, `ConfigError` on invalid) and verify new unit tests in
      `config.test.ts` pass
- [x] 1.3 Create `apps/server/src/logger.ts` with `createLogger(level)`, a
      silent default, secret redaction paths, and stdout-only output (no
      transport); verify unit tests for level filtering and redaction pass

## 2. Wire Into Startup

- [x] 2.1 In `bin.ts`, resolve `LOG_LEVEL`, create the root logger, and replace
      `console.log/warn/error` after config with logger calls (startup,
      listening address, effective level, TLS warning, fatal failure); verify by
      running the server with `LOG_LEVEL=debug` and `LOG_LEVEL=error` and
      observing output
- [x] 2.2 Verify an invalid `LOG_LEVEL` exits non-zero with an
      `Invalid LOG_LEVEL` message

## 3. HTTP Server Logging

- [x] 3.1 Add optional `logger` to `createServer` options (silent default) and
      log each request on response finish with method, path, status, duration,
      using the level mapping in design.md; verify via tests asserting entries
      for 200, 400, and 404 responses
- [x] 3.2 Log the currently swallowed `.catch(() => 500)` handler errors at
      `error` with stack, without changing responses; verify with a test that
      forces a handler exception
- [x] 3.3 Add `info`/`debug`/`warn` logs for source create/delete, statement
      processing outcomes (counts only), PDF read errors, and import requests;
      verify tests that no content or transaction fields appear in output

## 4. Actual Client Logging

- [x] 4.1 Add optional `logger` to `createActualClient`; log operation
      start/steps at `debug`, success with counts and duration at `info`, and
      failures at `warn` using sanitized messages; verify `actualClient.test.ts`
      additions pass
- [x] 4.2 Log incomplete-settings, timeouts, and `shutdown()` failures
      (previously swallowed) at `warn`; verify with tests
- [x] 4.3 Log the failing connection phase
      (load-api/init/download-budget/operation), per-phase timings, and the
      sanitized error cause chain (code, syscall, host) for Actual failures, and
      verify a test where an error message contains the stored server password
      logs `***` and never the secret

## 5. Stores Logging

- [x] 5.1 Add logger to `ActualSettingsStore`: `debug` on load, `info` on update
      listing changed field names only, `error` (then rethrow, behavior
      unchanged) when the file is unreadable; verify tests that password values
      never appear
- [x] 5.2 Add logger to `SourceStore` for load/persist failures at `error`
      (rethrown); verify with tests

## 6. Docs and Final Verification

- [x] 6.1 Document `LOG_LEVEL` (values, default, console-only, `pino-pretty`
      tip) in `README.md`
- [x] 6.2 Run lint, typecheck, and test tasks via Mise and verify all pass; run
      `openspec validate add-server-logging` and verify it passes

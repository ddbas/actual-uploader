## Context

The server (`apps/server`, plain `node:http`) stores Actual settings in
`ActualSettingsStore` (`getSecret()` returns full credentials) and serves
placeholder accounts from `accounts.ts`. The dashboard (`apps/dashboard`, React)
has Upload and Settings tabs in `App.tsx` with no header; `UploadTab` fakes the
upload. Transactions already follow Actual's `Transaction` shape. See
proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Real connection, status, accounts, and import using saved settings.
- Header indicator with pulse animation.

**Non-Goals:**

- Local DB, extra dedup logic, category/payee mapping, multiple budgets.

## Decisions

- **Use the official `@actual-app/api` Node package** in the server. Actual's
  sync protocol is not a plain REST API; the package is the supported way.
  Alternative: actual-http-api (extra service to run) - rejected.
- **Wrapper module `actualClient.ts`** exposing `withActual(settings, fn)`:
  `api.init({ serverURL, password, dataDir })` →
  `downloadBudget(syncId, { password: encryptionPassword })` → `fn(api)` →
  `api.shutdown()` in `finally`. A promise-chain mutex serializes calls (the
  package is process-global). Per-operation connect keeps settings changes live
  and avoids stale sessions, at the cost of latency. Alternative: long-lived
  session - rejected as more state/invalidations for a local tool.
- **Injectable client**: `createServer` accepts an `actualClient` option
  (interface: `getStatus()`, `listAccounts()`, `importTransactions(txs)`) so
  tests use a fake; the real implementation wraps `withActual`.
- **Data dir** is a temp/cache dir under the app's config dir (next to the
  settings file) so budget downloads are reused.
- **Import via `api.importTransactions(accountId, txs)`** grouped by account,
  then `api.sync()` (done by shutdown, but call explicitly). It applies
  `imported_id` de-duplication and rules; return `{ added, updated }`.
- **Status** uses a timeout (e.g. 15s) via `Promise.race`; errors are mapped to
  messages with secrets never included. Status results are not cached.
- **Dashboard**: new `ConnectionStatus` component in a new `<header>` in `App`.
  Polls `GET /api/actual/status` on mount and every 30s; exposes a refresh
  trigger (a lifted counter/callback) that `ActualSettingsPage` calls after a
  successful save. Pulse is a CSS keyframe animation on the green dot only;
  respect `prefers-reduced-motion`. State has `aria-live="polite"` text.
- Upload tab calls `importTransactions` and shows errors inline, keeping the
  review screen on failure.

## Risks / Trade-offs

- [Slow status checks since each downloads/opens the budget] → reuse data dir,
  30s poll, timeout; revisit with a cached session if painful.
- [`@actual-app/api` is large and needs matching server version] → document in
  README; surface version mismatch errors in the reason.
- [Concurrent poll and import contention] → serialization mutex.
- [Secrets leaking via error messages] → sanitize messages; test it.

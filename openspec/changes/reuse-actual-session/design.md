## Context

`withActual` in `apps/server/src/actualClient.ts` does load → init →
downloadBudget → operation → shutdown per call, serialized through a promise
queue. Actual's `init` logs in; the login endpoint is rate-limited per IP.

## Decisions

- **Session reuse inside the existing queue.** Keep the serialized queue. Store
  `session = { api, key, idleTimer }`, where `key` is a hash of serverUrl,
  password, syncId and encryptionPassword read at operation time. A key mismatch
  shuts the old session down and opens a new one, so "settings apply live" still
  holds. The idle timer calls `shutdown()` after 5 min without use.
- **Drop on failure.** Any error during init, download or the operation shuts
  the session down and clears it, so a broken session is never reused. Timeouts
  do the same.
- **Status cache.** Cache `{connected, error}` for 15s keyed by the settings
  key. Only status uses it; imports and account lists always run against the
  live session. `invalidate()` is called when settings are saved.
- **Backoff.** On `error.code === "too-many-requests"` record
  `blockedUntil = now + 60s`. While blocked, every operation fails immediately
  with `ActualRateLimitError` (carrying `retryAfterSeconds`) and makes no
  network call. Settings changes do not clear the block, since the limit is per
  IP.
- **Status shape.** `{connected:false, error, retryAfterSeconds?}` is additive,
  so existing clients keep working. The endpoint still returns 200.
- **Dashboard.** Poll at 60s, skip ticks while `document.hidden`, re-check on
  `visibilitychange`, and delay the next poll to at least `retryAfterSeconds`.

## Risks

- A long-lived session may go stale if the Actual server restarts. Mitigated by
  drop-on-failure plus one retry with a fresh session for the first failure of a
  reused session.
- The API holds a single open budget per process; unchanged, as operations stay
  serialized.

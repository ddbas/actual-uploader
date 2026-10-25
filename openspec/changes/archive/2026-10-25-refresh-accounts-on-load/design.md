## Context

The server keeps one Actual API session (`withActual`), opened with `init()` and
`downloadBudget()`, and reuses it for 5 minutes of idle time. `listAccounts()`
calls `getAccounts()`, which reads the local copy. `sync()` is only called after
imports (push), so remote changes are never pulled into a live session.

The login rate limit (5 per 15 min) on the Actual server counted successful
logins until v26.6.0 (actual#7707); after that only failures count. `sync()` is
not a login in any case.

## Goals / Non-Goals

**Goals:**

- The account select is current on each Upload tab load.
- No additional logins or budget downloads.

**Non-Goals:**

- Throttling, TTL caches, or a refresh button.
- Syncing on status checks or other endpoints.
- Changing session lifetime or the rate-limit backoff.

## Decisions

- **Sync on every accounts request, no throttle.** A throttle would reproduce
  the bug for a quick create-then-reload. The only trigger is a page load, so
  volume is low.
- **`sync()` inside `listAccounts()`, not in `withActual`.** Other operations
  don't need a pull, and status checks must stay cheap.
- **Degrade on sync failure.** Catch non-rate-limit errors from `sync()`, log a
  warning, and still return `getAccounts()`. Rate-limit errors rethrow so the
  existing backoff handles them. The session-reset-on-failure behavior of
  `withActual` must not trigger for the swallowed error.
- **Alternatives rejected:** re-downloading the budget per request (slow, extra
  logins); client-only change (the staleness is server-side).

## Risks / Trade-offs

- One extra round trip per Upload tab load. Acceptable.
- Actual servers older than v26.6.0 still count successful logins, but this
  change adds none. README notes the recommended version.

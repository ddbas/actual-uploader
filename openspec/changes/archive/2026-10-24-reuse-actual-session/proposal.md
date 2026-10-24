## Why

Every Actual operation (status check, account list, import) currently runs a
full `api.init()` login, downloads the budget, and shuts down. The dashboard
polls status every 30s and the upload tab lists accounts, so one browser tab
produces a steady stream of logins from a single IP. Actual rate-limits logins
per IP, so a deployment (observed on Kubernetes) soon gets
`Authentication failed: too-many-requests` on every call, and the polling then
keeps the limit tripped. The raw error is also unhelpful to the user.

## What Changes

- Keep the Actual API session open between operations instead of logging in each
  time. Re-initialize only when the connection settings change, after an
  authentication or network failure, or after an idle timeout (default 5 min).
- Cache the status result briefly (default 15s) so concurrent tabs and rapid
  refreshes share one check. Saving settings invalidates the cache.
- Back off on `too-many-requests`: stop contacting Actual for a cooldown
  (default 60s) and answer immediately with a rate-limit error, without making
  further login attempts.
- Map `too-many-requests` to a clear message: "Actual is rate-limiting logins;
  retrying in N s." Status responses carry the remaining wait.
- Dashboard: poll status every 60s, pause polling while the tab is hidden, and
  respect the server-provided retry delay.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actual-connection`: user-visible rate-limit reason and reduced polling.
- `actual-connection-technical`: session reuse, status cache, backoff, and error
  mapping replace "shut down after each operation".

## Impact

- `apps/server/src/actualClient.ts` and tests; the status route and
  settings-save handler (cache invalidation).
- `apps/dashboard/src/ConnectionStatus.tsx`, `api.ts` and tests.
- No new dependencies or settings; durations are internal defaults.

## Non-goals

- Configuring Actual's own rate limits (not possible server-side).
- Mapping other error codes (e.g. `network-failure`) beyond the rate-limit case.

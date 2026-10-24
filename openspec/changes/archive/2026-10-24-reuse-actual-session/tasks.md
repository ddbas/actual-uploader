## 1. Server session reuse

- [x] 1.1 Add session state (api, settings key, idle timer) to
      `createActualClient`; reuse it when the key matches, shut down and reopen
      when it differs; verify tests show one `init` for several operations and a
      new `init` after a settings change
- [x] 1.2 Shut the session down and clear it on any failure or timeout, retry
      once with a fresh session if a reused session fails; verify tests
- [x] 1.3 Add the idle timeout (default 5 min, injectable for tests) and shut
      down the session on expiry; verify with fake timers

## 2. Status cache and backoff

- [x] 2.1 Cache status results for 15s per settings key and expose
      `invalidate()`; call it when Actual settings are saved; verify repeated
      status calls cause one connection and a settings save forces a new check
- [x] 2.2 Detect `too-many-requests`, set a 60s `blockedUntil`, fail fast with
      `ActualRateLimitError` without network calls while blocked, and recover
      after the cooldown; verify with fake timers
- [x] 2.3 Map the error to "Actual is rate-limiting logins; retrying in N s."
      and add `retryAfterSeconds` to the status response, import and accounts
      502 bodies; verify the message never contains secrets

## 3. Dashboard

- [x] 3.1 Poll status every 60s, pause while the tab is hidden, re-check when it
      becomes visible; verify with fake timers
- [x] 3.2 Honor `retryAfterSeconds` when scheduling the next poll and show the
      reason in the tooltip; verify tests

## 4. Docs and wrap-up

- [x] 4.1 Note in the README that Actual rate-limits logins and the session is
      reused; run `mise run test`, lint, and build

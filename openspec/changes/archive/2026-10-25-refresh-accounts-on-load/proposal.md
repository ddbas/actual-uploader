## Why

The Upload tab's account select doesn't show accounts created in Actual Budget
after the server opened its Actual session, even after a page refresh. The
server reuses one session and reads accounts from its local budget copy, which
is never refreshed with remote changes.

## What Changes

- The accounts endpoint pulls the latest changes from the Actual server before
  listing accounts, so each Upload tab load shows the current accounts.
- If that pull fails, the endpoint serves the locally known accounts instead of
  failing.
- Session reuse and the rate-limit backoff are unchanged.
- README recommends Actual server v26.6.0 or newer, where only failed logins
  count against Actual's login rate limit.

## Capabilities

### New Capabilities

### Modified Capabilities

- `crawler-dashboard`: the account select reflects the accounts currently in
  Actual Budget when the Upload tab loads.
- `actual-connection-technical`: listing accounts first syncs the reused session
  with the Actual server, and degrades to cached data if the sync fails.

## Impact

- `apps/server/src/actualClient.ts` (`listAccounts`) and its tests.
- `README.md` (minimum recommended Actual server version).
- No client or API shape changes.

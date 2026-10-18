## Why

The Upload tab currently only pretends to upload: accounts are placeholder data
and confirming merely shows a message. Users have already entered their Actual
Budget server details in Settings, so the dashboard should use them to talk to
the real server, show whether that works, and actually import transactions.

## What Changes

- The server connects to Actual Budget using the saved Actual settings (server
  URL, server password, sync ID, optional encryption password).
- New connection status endpoint; the dashboard header shows a status indicator:
  pulsating green circle + "Connected", or non-pulsating red circle
  - "Not connected".
- `GET /api/accounts` returns the real accounts from the connected budget
  instead of placeholder data.
- New upload endpoint; "Upload to Actual" imports the reviewed transactions into
  Actual Budget and reports the real result (count added/updated, or an error).
  **BREAKING**: confirming no longer succeeds without a working connection.
- Uploads use Actual's import mechanism so `imported_id` de-duplicates.

## Capabilities

### New Capabilities

- `actual-connection`: Functional behavior of the Actual Budget connection
  status indicator in the dashboard header.
- `actual-connection-technical`: Server-side connection to Actual Budget, status
  endpoint, and transaction import endpoint.

### Modified Capabilities

- `crawler-dashboard`: "Confirm Before Uploading" now really uploads and reports
  success or failure; accounts come from the real budget.
- `statement-sources-technical`: Accounts endpoint returns real accounts and
  fails clearly when not connected.

## Impact

- `apps/server`: new `@actual-app/api` dependency, new Actual client module,
  routes `/api/actual/status`, `/api/actual/import`, updated `/api/accounts`.
- `apps/dashboard`: header status component, `api.ts` additions, `UploadTab`
  upload wiring, CSS for the pulse.
- Settings changes must take effect for subsequent connections.
- Out of scope: local database storage and cross-upload duplicate prevention
  beyond Actual's `imported_id` handling (see TODO.md).

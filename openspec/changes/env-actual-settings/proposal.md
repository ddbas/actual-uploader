## Why

The server ships as a Docker image, but the Actual Budget connection can only be
entered by hand in the dashboard after the container starts. Deployments should
be able to preconfigure the connection through environment variables so a fresh
container is connected immediately.

## What Changes

- Read the four Actual connection settings from environment variables:
  `ACTUAL_SERVER_URL`, `ACTUAL_SERVER_PASSWORD`, `ACTUAL_SYNC_ID` (required) and
  `ACTUAL_ENCRYPTION_PASSWORD` (optional). An empty value counts as unset.
- Environment values take precedence over UI-saved values **per field**. They
  are held in memory only and never written to `actual-settings.json`.
- Fields supplied by the environment are shown read-only in the Actual settings
  page with a "Set by environment" hint. Fields not supplied stay editable, so a
  partial environment (e.g. URL and sync ID only) is valid.
- `GET /api/settings/actual` reports which fields are environment-provided;
  `PUT` ignores locked fields.
- A malformed `ACTUAL_SERVER_URL` makes the server exit non-zero at startup,
  like an invalid `PORT`.
- Document the variables in the README, including that plain environment
  variables are visible via `docker inspect`. No `ENV` defaults are added to the
  Dockerfile and `*_FILE` secret variants are not supported.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-settings`: environment-provided fields are locked and precedence
  rules are user-visible.
- `dashboard-settings-technical`: the REST API exposes locked fields and ignores
  writes to them.
- `server-container-technical`: environment configuration of the Actual settings
  and startup validation.

## Impact

- `apps/server/src/config.ts`, `actualSettingsStore.ts`, `server.ts`, `bin.ts`
  and their tests.
- `apps/dashboard/src/api.ts`, `ActualSettingsPage.tsx` and tests.
- `README.md`.

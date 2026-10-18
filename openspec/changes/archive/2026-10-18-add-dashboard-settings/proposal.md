## Why

Configuration is currently scattered: sources have their own top-level tab, and
there is nowhere to tell the app which Actual Budget server to upload to. A
single Settings area with multiple pages gives configuration a home that can
grow as more general settings are added.

## What Changes

- Add a "Settings" tab to the dashboard containing multiple pages, with a
  navigation between them.
- Move source management (list, create, delete) out of its own top-level
  "Sources" tab into a "Sources" settings page. **BREAKING**: the top-level
  "Sources" tab is removed.
- Add an "Actual" settings page where the user enters their Actual Budget server
  connection details: server URL, server password, budget Sync ID, and an
  optional end-to-end encryption password.
- Server persists the Actual connection settings and exposes an API to read and
  save them; the password values are never returned to the browser.

## Capabilities

### New Capabilities

- `dashboard-settings`: Settings tab, page navigation, and the Actual settings
  page (functional behavior).
- `dashboard-settings-technical`: Persistence and REST API for Actual settings,
  secret handling.

### Modified Capabilities

- `statement-sources`: The "Sources Tab" requirement becomes a "Sources" page
  within Settings instead of a top-level tab.

## Impact

- `apps/dashboard`: `App.tsx` tab bar, new `SettingsTab` with page nav,
  `SourcesTab` rendered as a settings page, new `ActualSettingsPage`, `api.ts`.
- `apps/server`: new settings store and `/api/settings/actual` endpoints in
  `server.ts`.
- Specs: new `dashboard-settings*`, modified `statement-sources`.
- No uploading to Actual yet; this only collects and stores connection details.

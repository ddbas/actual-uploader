## Context

`App.tsx` holds a flat `tab` state with `home | results | sources`. `SourcesTab`
and `SourceWizard` already work standalone. The server keeps sources in
`SourceStore` (optional JSON file) and routes `/api/sources` in `server.ts`. See
proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Settings tab with pluggable pages; adding a page is one registry entry.
- Persist Actual connection details securely enough for a local tool.

**Non-Goals:**

- Connecting to or testing against an Actual server, uploading transactions, or
  mapping sources to Actual accounts.
- Real URL routing; no router dependency.

## Decisions

- **Page registry**: `SettingsTab` owns a `pages` array
  (`{id, label, component}`) and local `page` state, rendered as a vertical nav.
  Alternative: react-router — rejected as overkill for two pages.
- **Reuse `SourcesTab`** unchanged as the Sources page (rename optional) to keep
  its tests valid; only its mount point moves.
- **Fields**: Actual's API needs server URL, server password, and budget Sync
  ID; an encryption password is needed only for E2EE budgets, so it is optional.
- **`ActualSettingsStore`** mirrors `SourceStore` (optional file path, JSON,
  in-memory fallback) at `<dataDir>/actual-settings.json`, using the same data
  directory as `sources.json` (temporary storage approach, kept consistent until
  a permanent solution exists), written with mode 0600. Alternative: OS keychain
  — deferred; adds native dependencies.
- **Write-only secrets**: GET returns booleans; PUT treats an omitted/undefined
  password as "keep". Clearing the encryption password is done by sending an
  empty string.
- **Validation** is shared logic in the server; the dashboard does matching
  client-side checks for fast feedback, with server errors displayed too.
- **Default page** is "Sources" (first in registry).

## Risks / Trade-offs

- [Secrets stored in plaintext on disk] → 0600 permissions, never returned over
  the API; keychain storage is a follow-up.
- [Removing the Sources tab changes muscle memory] → Settings is always visible
  and opens on Sources.
- [Local HTTP API reachable by other local processes] → Same exposure as the
  existing API; out of scope here.

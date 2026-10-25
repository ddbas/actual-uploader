## 1. Server settings store and API

- [x] 1.1 Add `ActualSettingsStore` (get/update, optional JSON file, mode 0600)
  with unit tests for persistence, keep-on-omit, and file permissions
- [x] 1.2 Add validation (required url/password/syncId, http(s) URL) and tests
  for each failure case
- [x] 1.3 Add `GET`/`PUT /api/settings/actual` in `apps/server/src/server.ts`,
  wire store into server options and `bin.ts`; verify with server tests that GET
  never returns passwords and invalid PUT returns 400

## 2. Dashboard settings shell

- [x] 2.1 Add `SettingsTab` with page registry and nav; verify with a test that
  "Actual" is selected by default and switching pages works
- [x] 2.2 Update `App.tsx`: replace the "Sources" tab with "Settings" and render
  `SourcesTab` as the Sources page; update `SourcesTab.test.tsx`/App tests and
  verify no top-level "Sources" tab exists

## 3. Actual settings page

- [x] 3.1 Add API client functions in `api.ts` and types for Actual settings
- [x] 3.2 Add `ActualSettingsPage` with masked password fields, validation,
  pre-fill and saved confirmation; verify with component tests for save,
  required-field errors, invalid URL, and keep-existing-password
- [x] 3.3 Add basic styling consistent with existing tabs

## 4. Wrap-up

- [x] 4.1 Run `mise` lint/test/typecheck tasks and verify all pass
- [x] 4.2 Run `openspec validate add-dashboard-settings --strict` and verify it
  passes

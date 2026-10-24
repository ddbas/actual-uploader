## 1. Server configuration

- [x] 1.1 Add `resolveActualEnv` to `apps/server/src/config.ts` (empty → unset,
      non-http(s) URL → `ConfigError`) and verify unit tests cover set, empty,
      partial and invalid URL
- [x] 1.2 Give `ActualSettingsStore` an env-overrides option: `getSecret()`
      merges it over saved values, `get()` returns `locked` flags, and verify
      store tests cover merge, locked flags and precedence
- [x] 1.3 Make `update()` ignore locked fields, validate against the merged
      result, and persist only unlocked fields; verify tests show env values
      never appear in `actual-settings.json` and that removing env reveals the
      saved value
- [x] 1.4 Wire `bin.ts` to resolve the env overrides at startup and exit 1 with
      an error on `ConfigError`; verify a test (or manual run with
      `ACTUAL_SERVER_URL=ftp://x`) exits non-zero
- [x] 1.5 Verify `sanitizeError` masks env-provided passwords with a test in
      `actualClient.test.ts`
- [x] 1.6 Verify `server.ts` GET/PUT endpoint behavior with tests in
      `actualEndpoints.test.ts` (locked in GET, locked ignored in PUT, locked
      required satisfied)

## 2. Dashboard

- [x] 2.1 Add `locked` to `ActualSettingsView` in `apps/dashboard/src/api.ts`
      and verify types compile
- [x] 2.2 Update `ActualSettingsPage.tsx`: disable locked inputs, show "Set by
      environment" badge, omit locked fields from PUT, skip required checks for
      locked fields, disable Save when all are locked; verify
      `ActualSettingsPage.test.tsx` covers partial and fully-locked cases

## 3. Docs and verification

- [x] 3.1 Document the four variables and the `docker inspect` caveat in
      `README.md` with a `docker run` example, and verify it renders correctly
- [x] 3.2 Run `mise run test` and `mise run build` and verify both pass

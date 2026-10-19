## 1. Server Actual Client

- [x] 1.1 Add `@actual-app/api` to `apps/server` and verify `mise run`
      install/build succeeds
- [x] 1.2 Implement `actualClient.ts` (`withActual` with mutex, shutdown in
      finally, timeout, secret-free error mapping) and verify unit tests with a
      mocked API cover success, failure, serialization, and incomplete settings
- [x] 1.3 Define the injectable `ActualClient` interface (status, listAccounts,
      importTransactions) and verify server tests can pass a fake

## 2. Server Endpoints

- [x] 2.1 Add `GET /api/actual/status` and verify tests for connected and
      not-connected responses
- [x] 2.2 Replace placeholder `listAccounts` with the real client and verify
      `GET /api/accounts` tests for 200 and 502
- [x] 2.3 Add `POST /api/actual/import` with body validation, grouping by
      account, and sync, and verify tests for 200, 400, and 502

## 3. Dashboard

- [x] 3.1 Add `fetchActualStatus` and `importTransactions` to `api.ts` and
      verify with tests
- [x] 3.2 Add `ConnectionStatus` header component (green pulsing "Connected",
      red static "Not connected", "Checking…", reason tooltip, 30s polling,
      reduced-motion support) and verify component tests for each state
- [x] 3.3 Render the header in `App.tsx` and trigger a status refresh after
      saving Actual settings; verify a test that saving updates the indicator
- [x] 3.4 Wire `UploadTab` "Upload to Actual" to the import API with uploading
      state, success count, and retryable error; verify `UploadTab.test.tsx`
      covers success, failure, and in-progress

## 4. Wrap-up

- [x] 4.1 Manually verify against a real Actual server: indicator turns green,
      accounts list, uploaded transactions appear in Actual
- [x] 4.2 Update README/TODO.md (remove "Upload to Actual Budget") and run
      `mise run` lint, type-check, and test tasks to confirm all pass

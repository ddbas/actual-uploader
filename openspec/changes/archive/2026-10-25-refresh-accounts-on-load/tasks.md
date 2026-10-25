## 1. Server

- [x] 1.1 In `listAccounts()`, call `api.sync()` before `getAccounts()`; on a
  non-rate-limit error log a warning and continue
- [x] 1.2 Add tests in `actualClient.test.ts`: sync runs before listing, sync
  failure returns cached accounts, rate-limit error still triggers backoff, no
  extra login across requests
- [x] 1.3 Update the mock API in existing tests if needed

## 2. Docs

- [x] 2.1 README: recommend Actual server v26.6.0 or newer (failed-logins-only
  rate limit)

## 3. Validation

- [x] 3.1 Run `openspec validate refresh-accounts-on-load --strict` and the mise
  test/lint tasks

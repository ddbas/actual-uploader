## Why

Sources can now be defined, but nothing uses them. The dashboard's landing page
should let users upload statement files for a source and review the resulting
transactions. Web crawlers will no longer be used to collect transaction data,
so everything related to them is removed.

## What Changes

- New "Upload" tab, the default tab: choose a source and account, upload one or
  more files, review parsed transactions, confirm.
- Confirming shows a message that the transactions were uploaded to Actual
  Budget. The real Actual upload is not implemented yet.
- **BREAKING**: Removed the Home/Crawlers and Results tabs, the crawler
  interface, the mock crawler, the crawler run/SSE API, and their specs.
- `Transaction` type now lives in `statement-core`.

## Impact

- `apps/dashboard`, `apps/server`, `packages/statement-core`; the `crawler-core`
  and `crawlers` packages are deleted.

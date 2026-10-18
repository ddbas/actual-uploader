## Why

Sources can now be defined, but nothing uses them. The dashboard's landing page
should let users upload statement files for a source and review the resulting
transactions.

## What Changes

- New "Upload" tab, the default tab: choose a source and account, upload one or
  more files, review parsed transactions, confirm.
- The former "Home" tab (crawler list) is renamed "Crawlers".
- Confirming shows a message that the transactions were uploaded to Actual
  Budget. The real Actual upload is not implemented yet.

## Impact

- `apps/dashboard` only; uses the existing `/api/sources/:id/process` endpoint.

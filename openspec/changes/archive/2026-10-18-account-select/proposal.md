## Why

The Upload tab's account field was free text, but Actual Budget needs an account
ID. Users should pick an account by name.

## What Changes

- The account field becomes a select, labelled with account names and valued by
  account ID.
- The server exposes `GET /api/accounts`. Until the Actual Budget connection
  exists it returns a dummy account.

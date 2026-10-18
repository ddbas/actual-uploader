## Why

Banking sites' bot detection makes automated crawling impractical. Instead of
crawling, users will upload statements exported from their financial
institutions. Each institution uses different file types and layouts, so the
tool must let users teach it how to read each kind of statement.

## What Changes

- Add an "Upload Types" tab to the dashboard where users create, view, and
  delete "upload types" (e.g. "Desjardins checking & savings CSV").
- Add a guided wizard: the user uploads an example CSV, says whether the first
  row is a header, and maps CSV columns to Actual Budget transaction fields
  (date, amount, and optionally payee, notes, and a source id). Amounts may come
  from one signed column or from separate debit/credit columns. The user also
  picks the date format and decimal separator. An upload type can only be saved
  once every required field has a source.
- Persist saved upload types on the local server.
- Add a server endpoint that processes a CSV statement with a saved upload type
  into `Transaction` objects (the existing Actual Budget-shaped type).
- CSV is the only supported file format for now; the model is extensible to PDF.

## Non-Goals

- PDF parsing.
- A dashboard UI for processing statements with saved types (API only for now).
- Uploading to Actual Budget, de-duplication, or removing the crawler code.

## Capabilities

### New Capabilities

- `statement-upload-types`: functional requirements for the dashboard tab and
  wizard that define upload types.
- `statement-upload-types-technical`: storage, API, and parsing requirements.

## Impact

- New package `statement-core` (pure TS: CSV parsing, mapping, validation).
- `apps/server`: upload-type store and REST endpoints.
- `apps/dashboard`: new tab and wizard.

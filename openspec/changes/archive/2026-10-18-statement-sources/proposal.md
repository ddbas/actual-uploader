## Why

Banking sites' bot detection makes automated crawling impractical. Instead of
crawling, users will upload statements exported from their financial
institutions. Each institution uses different file types and layouts, so the
tool must let users teach it how to read each kind of statement.

## What Changes

- Add an "Sources" tab to the dashboard where users create, view, and delete
  "sources" (e.g. "Desjardins checking & savings CSV").
- Add a guided wizard modelled on Actual Budget's CSV importer: the user uploads
  an example CSV; the wizard auto-detects the delimiter, header, columns, date
  format and decimal separator; and the user adjusts a field-to-column mapping
  (date, payee, notes, transaction ID, and amounts). Amounts may be a single
  signed column, separate outflow/inflow columns, or an amount column plus an
  in/out column; amounts can be flipped; lines can be skipped at the start and
  end of the file. Payee and amount columns are detected from values when
  headers don't say (e.g. merchant-like text, amounts with cents). Date format
  is detected across all sample rows, columns that cannot supply a field (empty,
  or not date/amount-like) are not offered, and columns are named by header plus
  a sample value. A column selected for one field remains offered for the
  others, but a source cannot be saved while the same column is assigned to more
  than one field. A preview table shows the parsed transactions. A source can
  only be saved once every required field is mapped to a column.
- Deleting a source requires explicit confirmation from the user.
- Persist saved sources on the local server.
- Add a server endpoint that processes a CSV statement with a saved source into
  `Transaction` objects (the existing Actual Budget-shaped type). The account is
  supplied when processing, not stored on the source.
- CSV is the only supported file format for now; the model is extensible to PDF.

## Non-Goals

- PDF parsing.
- A dashboard UI for processing statements with saved types (API only for now).
- Uploading to Actual Budget, de-duplication, or removing the crawler code.

## Capabilities

### New Capabilities

- `statement-sources`: functional requirements for the dashboard tab and wizard
  that define sources.
- `statement-sources-technical`: storage, API, and parsing requirements.

## Impact

- New package `statement-core` (pure TS: CSV parsing, mapping, validation).
- `apps/server`: source store and REST endpoints.
- `apps/dashboard`: new tab and wizard.

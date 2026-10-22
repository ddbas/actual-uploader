## Why

Many banks, credit cards especially, only provide statements as PDFs. Today the
importer only understands CSV, whose rows and columns are predictable. A PDF has
no table structure, only positioned text, so the user has to show us where the
data is, and no single extraction technique will fit every statement.

## What Changes

- Add a **PDF** file format alongside CSV when creating a source.
- Introduce **extraction approaches**: pluggable strategies for turning a PDF
  into transactions. The wizard has a select to switch approaches on the same
  example PDF, and the app can gain new approaches later without reworking the
  wizard, storage or upload flow.
- Ship one approach, **Aligned columns**, for statements whose tables are laid
  out by alignment rather than drawn borders. It is generic and bank-agnostic:
  - the dashboard renders the example PDF and lets the user place vertical
    column dividers (pre-suggested from the text positions);
  - each line that begins with a date becomes a row, and other lines are
    ignored;
  - the user maps the resulting columns to transaction fields with the same
    controls as the CSV wizard.
- Recognise dates **with or without a year**. When the chosen date column has no
  year, the user must click the text on the rendered page that contains the
  year, and the year is resolved per row, rolling back across a year boundary.
- Add a general **credit-suffix amount option** (e.g. amounts ending in `CR` are
  inflows) to the shared amount layouts, usable for CSV and PDF alike.
  Previously a `CR` suffix was silently dropped, flipping the sign.
- Let the Upload tab accept PDF files for PDF sources, and show **warnings**
  (e.g. "no transactions found") on the processing result.
- Add a new `statement-pdf` package, the only place that reads PDF bytes, so the
  extraction logic in `statement-core` stays pure and identical in browser and
  server.
- **Not included** (follow-ups): reconciling extracted rows against the totals
  printed on the statement, merging wrapped continuation lines into the previous
  row, OCR for scanned PDFs, ruled-table (border detection) and other
  approaches.

## Capabilities

### New Capabilities

- `pdf-sources`: Functional behaviour of creating a PDF source in the dashboard:
  choosing the format, uploading an example PDF, switching extraction
  approaches, setting up the Aligned columns approach, handling dates without a
  year, and previewing the result.
- `pdf-extraction-technical`: Architecture for PDF extraction: the approach
  contract and registry, the `statement-pdf` package boundary, the stored source
  shape, the Aligned columns algorithm, year resolution and PDF processing on
  the server.

### Modified Capabilities

- `statement-sources`: The amount options gain the credit-suffix marker.
- `statement-sources-technical`: The processing endpoint accepts PDF content and
  returns warnings, and amount parsing supports the credit-suffix marker.
- `crawler-dashboard`: The Upload tab accepts PDF files for PDF sources and
  shows processing warnings.

## Impact

- **Packages**: `statement-core` (source union, approach contract, Aligned
  columns, year-less dates, credit marker); new `statement-pdf` (pdfjs-dist).
- **Server** (`apps/server`): source validation for PDF sources, a PDF branch in
  `POST /api/sources/:id/process`, a `warnings` list on the result, and font
  data for pdfjs in the Docker image.
- **Dashboard** (`apps/dashboard`): format choice in the source wizard, a PDF
  wizard (approach select, page viewer with dividers and year click), extraction
  of the CSV mapping step so it can be reused, and PDF support in the Upload
  tab.
- **Dependencies**: `pdfjs-dist`.
- **Data**: existing CSV sources are unaffected. PDF sources are stored in the
  same JSON file with a new `format`.

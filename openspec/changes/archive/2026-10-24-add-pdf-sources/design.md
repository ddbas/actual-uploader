## Context

See `proposal.md` for motivation. The current pipeline is CSV-only.
`statement-core` parses CSV text into `string[][]`, and a `CsvSource` maps
columns by index to a `Transaction`. The dashboard wizard (`SourceWizard.tsx`)
and the server's `POST /api/sources/:id/process` both import that same pure
package, which is how "preview equals upload" is guaranteed. `Source` is already
declared as a union "so other formats (e.g. PDF) can be added later".

A PDF has no rows or columns, only positioned text runs. Checked against a real
credit card statement:

- Its table has **no drawn borders**, so ruled-table detection (e.g. `pdf-parse`
  `getTable()`) finds nothing. Alignment is the only structure.
- Words arrive fragmented (`LES`, `GRILLADES`, `DU`) and thousands digits can be
  a separate item (`1` + `979,73CR`).
- Dates are day and month only, in two cells, with no year on the row.
- Credits carry a `CR` suffix on the amount, which `parseAmount` currently
  discards.
- Headings, totals and page furniture surround the rows, and the same column
  positions repeat on every page.

The user wants several extraction approaches to be switchable in the wizard,
with only one built now, and wants that approach to be generic rather than
shaped around one bank.

## Goals / Non-Goals

**Goals:**

- A small, stable contract so a new approach needs no changes to storage, the
  process endpoint or the wizard shell.
- One generic approach (Aligned columns) that makes no assumptions about a
  particular issuer: dividers, a date-anchored row rule, and CSV-style mapping.
- Identical results in browser and server.
- Reuse the existing mapping, guessing, preview and validation code where an
  approach wants it.

**Non-Goals:**

- OCR, password entry, or reading images.
- Reconciliation against totals printed on the statement (follow-up). The
  result's `warnings` leave room for it.
- Merging continuation (wrapped) lines into the previous row.
- Per-page dividers or different column layouts on different pages.
- Border-based (ruled table) detection, LLM extraction or other approaches.
- Editing a saved source (not supported for CSV today either).

## Decisions

### D1. Thin approach contract: transactions out

An approach is
`{ id, label, run(items, config) → { transactions, errors, warnings } }` in
`statement-core`, plus a setup editor component in the dashboard. Its `config`
is opaque, versioned JSON that it also validates.

There are two moments. At **setup** time the user works the approach's editor
against an example PDF and the output is the saved `config` (the "algorithm").
At **run** time `run(newPdfItems, savedConfig)` produces transactions.

_Alternative considered:_ every approach returns a grid of cells plus named
fields and the shared CSV-style mapping UI sits downstream. Rejected: it only
pays off once a second grid-shaped approach exists, it forces future approaches
(e.g. one that finds transactions directly) to fit a grid, and the user
preferred transactions as the only common output. Aligned columns uses the
mapping toolkit internally by choice.

### D2. Registry in core, editors in the dashboard

`statement-core` exports a registry `id → approach`. The dashboard has a second
map `id → editor component`, typed as a complete record over the registry's
identifiers so a missing editor is a compile error. React stays out of core.

The wizard **shell** owns the approach select, the example PDF (read once into
items), the transaction preview (it calls the approach's `run` on the current
config) and a per-approach config store so switching away and back restores
state. Approach editors are controlled components over their own config.

### D3. `statement-pdf` is the only PDF-parser consumer

`statement-core` keeps its "pure, no I/O, Node- and browser-safe" rule. A new
package `statement-pdf` wraps `pdfjs-dist` and exposes one function: bytes →
pages of `{ width, height, items: { text, x, y, width, height }[] }` in PDF
points. It throws typed errors for encrypted PDFs and PDFs with no text.
Approaches work on items, so they are unit-tested with JSON fixtures and never
parse a PDF.

_Alternatives:_ `pdf-parse` v2 (a wrapper over `pdfjs-dist` whose `getTable()`
is border-based and returned zero tables on the sample statement, and I did not
find it exposes raw items); a Python or Java sidecar like Camelot or Tabula
(adds a second runtime to a single-Node container). Using `pdfjs-dist` directly
gives positioned items with the least indirection. A ruled-table approach could
use `pdf-parse` later without changing this boundary.

The same package is used in the dashboard (for page text and, via pdfjs, page
rendering) and on the server, so the items are identical. The pdfjs `legacy`
build is used under Node, and its standard font data path is configured, which
the Docker image must also provide.

### D4. Source model

`Source = CsvSource | PdfSource`. `PdfSource` is
`{ id, name, format: "pdf", approach, config }`. The column-mapping fields of
`CsvSource` (date column and format, amount layout, decimal separator, flip,
payee, notes, transaction ID) are extracted into a shared `FieldMapping` type
and the new credit marker is added to it. CSV keeps its fields flat, so stored
CSV sources are unchanged and need no migration. The Aligned columns `config`
embeds a `FieldMapping` alongside its own dividers and year anchor.
`validateSource` checks the common fields and delegates `config` to the approach
through the registry. Duplicate-column rules are reused for `FieldMapping`.

### D5. Aligned columns algorithm

1. **Lines:** group items per page by vertical position with a tolerance of a
   fraction of the item height, then order lines top to bottom.
2. **Runs:** within a line, sort by x and join neighbouring items whose gap is
   at most about a word space (a fraction of the text height). Words and split
   digits join, while a day and a month in separate cells (a gap several times
   larger) do not.
3. **Cells:** the saved dividers are x positions in PDF points shared by all
   pages. A run belongs to the cell containing its horizontal midpoint, so
   right-aligned values of different widths land in one column. Runs in one cell
   are joined with a space.
4. **Rows:** build one grid row per line, then keep the lines whose date-column
   cell parses as a date. Headings, totals, footers and wrapped text have none
   and disappear without rules about what they are. This is why no table-region
   box is needed.
5. **Map:** the surviving rows go through the existing row mapping
   (`interpretRow` / `mapRow`) using the config's `FieldMapping`.

_Suggested dividers:_ cluster the left and right edges of runs across all pages
and place a divider in each sizeable vertical gutter that is empty on (nearly)
every line. These are only defaults, and the user adjusts them, mirroring the
CSV "guess, then edit" flow. Mapping is guessed by the existing heuristics over
the grid (first date-like column for the date, amount-like column for the
amount, and so on).

_Date column vs row filter:_ the grid is built from all lines before a date
column is chosen. The guess picks the date column from the cell shapes across
lines, the user can change it, and rows are re-filtered. Merging a day and month
is done by removing the divider between them, so no multi-column date feature is
needed.

### D6. Year-less dates

Two formats are added to the shared date parsing: `DD MM` and `MM DD`. They
parse to month and day only, are offered for PDF sources only (CSV has no year
source), and are combined with a year by the approach.

The user clicks the text that contains the year. The click is stored as a year
anchor: `{ page, x, y }` in PDF points. At run time the text item at that
position is read from the PDF being processed and its first four-digit year is
the anchor year, taken to be the year of the **last row**. The year of earlier
rows is found by walking backwards in document order and stepping the year back
each time the month jumps **upward by more than six**. A threshold avoids false
rollovers from slightly out-of-order dates (e.g. 10-02, 09-30, 10-01), and a
real December to January boundary jumps by eleven.

_Alternatives:_ asking for a full statement date and comparing each row's month
(needs a month too and a single clean item); typing the year at upload time
(manual on every file); label-based lookup (needs a relative-to-label rule). A
fixed position is simple and matches the same-template, same-bank model of a
source.

### D7. Credit marker

`FieldMapping` gains an optional `creditMarker` (single amount layout). When
set, an amount ending in the marker (case-insensitive, after trimming) is
positive and others negative, ignoring the printed sign, and the marker text is
removed before the numeric parse. Flip is applied afterwards. Because
`parseAmount` already strips non-digit text, the change is in how `interpretRow`
determines the sign, not in the number parsing. It is shown in both wizards
since the logic is shared.

### D8. Processing endpoint and warnings

`POST /api/sources/:id/process` keeps its URL. For PDF sources the body carries
the PDF as base64 in the existing JSON envelope (`{ account, contentBase64 }`),
which avoids multipart handling and fits the current `readBody`/`sendJson`
helpers at the cost of ~33% size overhead on small statements. The result
becomes `{ transactions, errors, warnings }` for every format, with an empty
`warnings` for CSV. `errors` for PDFs identify page and line. Read failures (not
a PDF, encrypted, no text) return a 4xx error with a reason. The dashboard
Upload tab reads PDFs as `ArrayBuffer`, base64-encodes them, and renders
`warnings` with the results. A zero row result is a warning on a normal
response, not an error.

### D9. Dashboard

The format choice goes in front of the existing wizard, which is split so the
CSV column mapping step (field selects, layout options, mapped preview) is a
reusable component. The Aligned columns editor composes a page viewer with the
divider and year-click overlays on that mapping step. Page rendering uses pdfjs
(`getViewport` / canvas) and overlays are positioned from PDF-point coordinates
scaled by the current zoom.

### D10. Fixtures

Tests run on a hand-built JSON fixture of text items modelled on the real
layout: the real column positions and fragmentation patterns, but invented
names, addresses, account numbers and amounts. The real statement contains
personal data and is not committed. A tiny generated PDF could later cover the
`statement-pdf` package.

## Risks / Trade-offs

- **Layout drift** (a bank moves columns) → rows silently drop or misalign.
  Mitigation: per-row errors, a "no transactions found" warning, and the
  preview. Reconciliation against statement totals is the planned stronger guard
  (follow-up).
- **Wrapped and continuation lines are ignored**, so extra descriptive text is
  lost and a long description's second line never reaches the payee. Accepted
  for v1. Merging is risky because a totals line below the last row would
  corrupt it.
- **Year inference assumes rows in date order and spanning under 12 months.**
  Mitigation: the six-month threshold and the preview's raw/parsed date display.
- **Anchor depends on a fixed position** and breaks if the bank moves the date.
  Mitigation: a "year could not be determined" error and warning, and
  re-creating the source.
- **Divider heuristics may place poor defaults** on unusual layouts. The user
  can always edit them.
- **pdfjs size** in the dashboard bundle and its worker setup. Mitigation: load
  it only when a PDF source is created, and keep it isolated in `statement-pdf`.
- **One column set for all pages** cannot handle pages with different layouts.
  Accepted, noted as a non-goal.
- **Spec drift for `Source` consumers**: widening the union touches every place
  that assumes CSV (`processCsv` in the server, wizard types). The compiler
  finds them.

## Migration Plan

No data migration. Existing sources and the data file layout keep working, and
PDF sources are added to the same file. The Docker image gains the pdfjs font
data. To roll back, remove PDF sources from the data file, since older versions
would reject the unknown format.

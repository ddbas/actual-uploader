# pdf-extraction-technical Specification

## Purpose

Defines the architecture for PDF statement extraction: the extraction approach
contract and registry, the package boundary around PDF reading, the stored
source shape, the Aligned columns algorithm, year resolution, and PDF processing
on the server.

## Requirements

### Requirement: Extraction Approach Contract

Each PDF extraction approach SHALL have a stable identifier, a display name, and
a pure `run` function that takes the text items of a PDF and the approach's
saved configuration and returns transactions, per-row errors and warnings. The
saved configuration SHALL be opaque to everything except its approach and SHALL
carry a version. Each approach SHALL validate its own configuration. The `run`
function SHALL live in `statement-core` and perform no I/O, so the dashboard and
the server run identical code.

#### Scenario: Same result in browser and server

- **WHEN** the same text items and configuration are run in the dashboard and on
  the server
- **THEN** the resulting transactions, errors and warnings are identical

#### Scenario: Configuration is validated by its approach

- **WHEN** a configuration is invalid for its approach (for example a missing
  required column)
- **THEN** the approach reports human-readable problems

### Requirement: Approach Registry

`statement-core` SHALL expose a registry of the available approaches, keyed by
identifier, used by the dashboard to list approaches and by the server to run
them. The dashboard SHALL provide a setup editor for every registered approach,
and this SHALL be enforced at compile time so an approach cannot be added
without one. Adding an approach SHALL NOT require changes to source storage, the
processing endpoint, or the wizard shell.

#### Scenario: Unknown approach rejected

- **WHEN** a source names an approach that is not registered
- **THEN** validation reports it and the source is not stored

#### Scenario: New approach is picked up

- **WHEN** a new approach is registered with its editor
- **THEN** it appears in the approach select and can be used to save and process
  sources with no other change

### Requirement: PDF Reading Is Isolated in statement-pdf

A new package `statement-pdf` SHALL be the only package that depends on a PDF
parser. It SHALL turn PDF bytes into, per page, the page size and positioned
text items (text, horizontal and vertical position, width and height, in PDF
points with the origin at the page's bottom-left). It SHALL work in Node and in
the browser, and SHALL fail with distinguishable errors for password-protected
PDFs and for PDFs with no text.

#### Scenario: Positioned items

- **WHEN** a text-based PDF is read
- **THEN** each page is returned with its width and height and one item per text
  run with its position

#### Scenario: No text

- **WHEN** a PDF has no text items on any page
- **THEN** reading fails with a "no text" error

#### Scenario: Encrypted

- **WHEN** a PDF needs a password
- **THEN** reading fails with a "password protected" error

#### Scenario: Pure logic stays pure

- **WHEN** `statement-core` is inspected
- **THEN** it has no dependency on the PDF parser

### Requirement: PDF Source Shape and Validation

A PDF source SHALL be stored with `format` "pdf", the identifier of its approach
and that approach's configuration, alongside the existing sources in the same
data file. Validation in `statement-core` SHALL check the common fields (name,
format, known approach) and delegate the configuration to the approach. The same
validation SHALL run in the dashboard and the server. Existing CSV sources SHALL
remain valid without migration.

#### Scenario: Valid PDF source stored

- **WHEN** a source with a known approach and a valid configuration is posted
- **THEN** the server stores it and returns it in the source list

#### Scenario: Invalid configuration rejected

- **WHEN** a PDF source's configuration fails its approach's validation
- **THEN** the server responds 400 with the messages and does not store it

#### Scenario: CSV sources unaffected

- **WHEN** the server loads a data file written before PDF support
- **THEN** its CSV sources are listed and processed as before

### Requirement: PDF Processing Endpoint

`POST /api/sources/:id/process` SHALL accept, for a PDF source, the PDF content
(base64-encoded in the JSON body) and an account id. It SHALL read the PDF, run
the source's approach and respond with the transactions, per-row errors and
warnings. A PDF that cannot be read SHALL produce an error response naming the
reason.

#### Scenario: PDF processed

- **WHEN** a valid PDF is posted for a saved PDF source
- **THEN** the response contains the extracted transactions for the given
  account

#### Scenario: Unreadable PDF

- **WHEN** the posted content is not a PDF, is password-protected or has no text
- **THEN** the response is an error whose message names the reason

### Requirement: Aligned Columns Extraction Algorithm

The Aligned columns approach SHALL extract in these steps:

1. Group the text items of each page into lines by vertical position, tolerating
   small baseline differences.
2. Join items on the same line that are separated by no more than a word space
   into one text run, so words and split digits stay together.
3. Assign each run to the cell whose horizontal span, defined by the saved
   dividers (in PDF points, shared by all pages), contains the run's midpoint.
4. Keep as rows only the lines whose cell in the date column parses as a date
   under the saved date format, in document order (pages in order, lines
   top-to-bottom).
5. Map each row to a transaction with the saved column mapping.

Row numbers in errors SHALL identify the page and line.

#### Scenario: Words and split digits stay together

- **WHEN** a line contains the items "LES", "GRILLADES" and "DU" separated by
  word spaces, and the items "1" and "979,73CR" separated by less than a word
  space
- **THEN** the first three form one run, and the last two form the single run "1
  979,73CR"

#### Scenario: Right-aligned values

- **WHEN** amounts of different widths are right-aligned in one column
- **THEN** each is assigned to that column regardless of where its text starts

#### Scenario: Non-date lines ignored

- **WHEN** a line's date cell does not parse as a date
- **THEN** the line produces neither a transaction nor an error

#### Scenario: Row with a date but an invalid amount

- **WHEN** a line's date cell parses but its amount cell does not
- **THEN** the line produces an error identifying its page and line, and no
  transaction

#### Scenario: Warning when nothing is found

- **WHEN** no line in the PDF has a date in the date column
- **THEN** the result has no transactions and includes a warning that no
  transactions were found

### Requirement: Year-less Date Parsing and Year Resolution

`statement-core` SHALL parse dates that contain only a day and a month (`DD MM`,
`MM DD`) regardless of the separator and including month names. The approach
SHALL resolve the year of each year-less date from a saved year anchor: the page
and position of the text the user clicked, whose text is read from the PDF being
processed. The anchor year SHALL be taken as the year of the last row, and
walking backwards through the rows in document order, the year SHALL step back
by one each time the month jumps upward by more than six months. Rows that
cannot be parsed SHALL NOT affect the resolution.

#### Scenario: Year boundary

- **WHEN** rows are, in order, "28 12", "03 01" and the anchor year is 2026
- **THEN** their dates are 2025-12-28 and 2026-01-03

#### Scenario: Small backward step is not a boundary

- **WHEN** rows are, in order, "02 10", "30 09", "01 10" and the anchor year is
  2026
- **THEN** all three are in 2026

#### Scenario: Anchor text cannot be found

- **WHEN** the PDF has no text at the saved anchor position or the text contains
  no year
- **THEN** year-less rows produce errors saying the year could not be
  determined, and the result includes a warning

#### Scenario: Dates with a year ignore the anchor

- **WHEN** the date cells contain a year
- **THEN** no anchor is required and none is read

### Requirement: Dashboard Page Rendering and Overlays

The dashboard SHALL render PDF pages for display and draw the column dividers
and the selected year text over them using the same coordinates (PDF points)
that are stored, so positions are independent of the zoom level and of the page
size of later uploads' PDFs. The approach editors SHALL receive the text items
of the example PDF and report their configuration through a common editor
interface; the shell SHALL own the approach select, the example PDF and the
transaction preview.

#### Scenario: Zoom independence

- **WHEN** the user zooms the page display after placing a divider
- **THEN** the divider remains over the same text and the stored position is
  unchanged

### Requirement: Synthetic Test Fixture

The repository SHALL contain a synthetic text-items fixture modelled on a real
statement's layout (real column positions, invented names and amounts) and no
real personal data, and unit tests of the Aligned columns approach SHALL run
against it.

#### Scenario: Fixture contains no personal data

- **WHEN** the fixture is reviewed
- **THEN** its names, addresses, account numbers and amounts are invented

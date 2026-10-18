## ADDED Requirements

### Requirement: Upload Types Are Persisted by the Server

The server SHALL persist upload types to a JSON file in a data directory
(configurable via `ACCOUNT_CRAWLER_DATA_DIR`) so they survive restarts.

#### Scenario: Upload types survive a restart

- **WHEN** an upload type is saved and the server is restarted
- **THEN** the upload type is still returned by the list endpoint

### Requirement: Upload Type REST API

The server SHALL expose `GET /api/upload-types`, `POST /api/upload-types`, and
`DELETE /api/upload-types/:id`. `POST` SHALL reject (HTTP 400, with error
messages) any upload type lacking a name or a source for a required field.

#### Scenario: Invalid upload type rejected

- **WHEN** a POST omits the amount source
- **THEN** the server responds 400 and does not store it

### Requirement: Statement Processing Endpoint

The server SHALL expose `POST /api/upload-types/:id/process` accepting a CSV
statement body and an account id, and returning `Transaction` objects (amounts
as integer cents, dates as `YYYY-MM-DD`) plus per-row errors for rows that could
not be parsed.

#### Scenario: Statement processed

- **WHEN** a valid CSV is posted for a saved upload type
- **THEN** the response contains one transaction per data row, excluding the
  header row when configured

### Requirement: Shared Pure Statement Package

CSV parsing, mapping, and validation SHALL live in a Node- and browser-safe
package `statement-core` with no I/O, used by both server and dashboard.

#### Scenario: Preview matches server output

- **WHEN** the same file and mapping are processed in the dashboard and server
- **THEN** the resulting transactions are identical

### Requirement: Flexible Date Parsing

Date parsing SHALL be based on field order and year width (`YYYY MM DD`,
`YY MM DD`, `MM DD YYYY`, `MM DD YY`, `DD MM YYYY`, `DD MM YY`) independent of
the separator, and SHALL accept month names, unseparated digits, and two-digit
years (read as 20YY). Invalid calendar dates SHALL be rejected.

#### Scenario: Separator-agnostic parsing

- **WHEN** "05.03.24" is parsed as `DD MM YY`
- **THEN** the result is `2024-03-05`

### Requirement: Processing Honors Skipped Lines and Amount Options

Processing SHALL ignore the configured skipped lines at the start and end of the
file, ignore the header row when configured, apply flip-amount, and compute
amounts for the single, debit/credit, and in/out layouts. Row errors SHALL
report row numbers relative to the original file.

#### Scenario: In/out amounts

- **WHEN** a row's in/out cell equals the configured out value
- **THEN** its amount is negative, otherwise positive

### Requirement: Column Analysis and Date Format Detection

`statement-core` SHALL provide column analysis (whether a column has values,
looks like dates, looks like amounts, and a sample value) and date format
detection over many samples, tolerating a small share of non-matching rows, and
returning all equally-fitting formats so ambiguity can be reported. Amount
detection SHALL NOT treat dates as amounts.

#### Scenario: Footer row tolerated

- **WHEN** a date column has valid dates in most rows and "Total" in the last
- **THEN** the date format is still detected

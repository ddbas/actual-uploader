# statement-sources-technical Specification

## Purpose

TBD - created by archiving change statement-sources. Update Purpose after
archive.

## Requirements

### Requirement: Sources Are Persisted by the Server

The server SHALL persist sources to a JSON file in a data directory
(configurable via the `DATA_DIR` environment variable) so they survive restarts.

#### Scenario: Sources survive a restart

- **WHEN** a source is saved and the server is restarted
- **THEN** the source is still returned by the list endpoint

### Requirement: Source REST API

The server SHALL expose `GET /api/sources`, `POST /api/sources`, and
`DELETE /api/sources/:id`. `POST` SHALL reject (HTTP 400, with error messages)
any source lacking a name or a column mapping for a required field, or that
assigns the same column to more than one field. Validation SHALL live in
`statement-core` so the dashboard and server apply identical rules.

#### Scenario: Invalid source rejected

- **WHEN** a POST omits the amount source
- **THEN** the server responds 400 and does not store it

#### Scenario: Duplicate column rejected

- **WHEN** a POST assigns one column to two fields (e.g. date and payee)
- **THEN** the server responds 400 and does not store it

### Requirement: Statement Processing Endpoint

The server SHALL expose `POST /api/sources/:id/process` accepting a statement
body and an account id, and returning `Transaction` objects (amounts as integer
cents, dates as `YYYY-MM-DD`), per-row errors for rows that could not be parsed,
and a list of warnings (empty when there are none). For a CSV source the body is
the CSV text. For a PDF source the body is the PDF content, as specified by
`pdf-extraction-technical`.

#### Scenario: Statement processed

- **WHEN** a valid CSV is posted for a saved source
- **THEN** the response contains one transaction per data row, excluding the
  header row when configured, and an empty list of warnings

#### Scenario: PDF source processed

- **WHEN** a valid PDF is posted for a saved PDF source
- **THEN** the response has the same shape, with the transactions, errors and
  warnings of the source's extraction approach

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
looks like dates, looks like amounts, a sample value, the share of values that
end in cents, the share containing letters, the variety of distinct values, and
average value length) and date format detection over many samples, tolerating a
small share of non-matching rows, and returning all equally-fitting formats so
ambiguity can be reported. Amount detection SHALL NOT treat dates as amounts.

#### Scenario: Footer row tolerated

- **WHEN** a date column has valid dates in most rows and "Total" in the last
- **THEN** the date format is still detected

### Requirement: Mapping Guess Heuristics

`statement-core` SHALL provide a mapping guess that, from header names and
column analysis, assigns each column at most once and returns the field
assignments, amount layout, date format, and decimal separator. When headers do
not identify a field it SHALL fall back to value-based rules: the first
date-like column for the date; an amount-like, non-date column for the amount,
preferring columns whose values have cents; and, for the payee, the unassigned
column that is mostly letters and scores highest on variety times average length
(capped), excluding date-like and amount-like columns.

#### Scenario: Payee chosen by value shape

- **WHEN** a headerless file has an account-number column, a repeating
  "Debit"/"Credit" column, and a merchant-name column
- **THEN** only the merchant-name column is assigned to payee

#### Scenario: Account numbers are not amounts

- **WHEN** a headerless file has an integer-only column and a column of values
  with cents
- **THEN** the column with cents is assigned to amount

#### Scenario: No payee candidate

- **WHEN** no unassigned column is mostly letters
- **THEN** payee is left unassigned

### Requirement: Transaction Shape Aligned With Actual Budget

The system SHALL define a `Transaction` type whose fields match the Actual
Budget API `Transaction` model (https://actualbudget.org/docs/api/reference), so
transactions produced from uploaded statements can be passed to Actual Budget's
`importTransactions`/`addTransactions` APIs without transformation. At minimum
the type SHALL support: `account`, `date` (`YYYY-MM-DD`), `amount` (integer, no
decimal places), `payee_name`, `imported_payee`, `category`, `notes`,
`imported_id`, `cleared`, and `id` (all optional except `account` and `date`,
consistent with the Actual Budget spec).

#### Scenario: Processing yields a well-formed transaction

- **WHEN** a statement row is processed using a source
- **THEN** the resulting object satisfies the `Transaction` type, including a
  `date` in `YYYY-MM-DD` format and an integer `amount` with no decimal places

#### Scenario: Transaction is ready for Actual Budget import

- **WHEN** processed transactions are passed to Actual Budget's
  `importTransactions` API
- **THEN** no field renaming or reshaping is required beyond selecting the
  target `accountId`

### Requirement: Accounts Endpoint

The server SHALL expose `GET /api/accounts` returning a list of `{ id, name }`
objects matching Actual Budget's `getAccounts()` result for the connected
budget. When the connection fails it SHALL respond 502 with an `error`.

#### Scenario: Accounts are listed

- **WHEN** a client requests `GET /api/accounts` while connected
- **THEN** the response is a JSON array of objects each with an `id` and a
  `name`

#### Scenario: Not connected

- **WHEN** a client requests `GET /api/accounts` and the connection fails
- **THEN** the response is 502 with an `error` message

### Requirement: Credit Marker Amount Parsing

Amount interpretation SHALL support an optional credit marker, case-insensitive
text at the end of the amount value. When a marker is configured for the single
amount layout, an amount ending in the marker SHALL be an inflow and any other
amount an outflow, regardless of printed sign, and the marker SHALL NOT affect
the numeric value. The flip-amount option SHALL apply after the marker. Without
a configured marker, parsing SHALL be unchanged. Source validation SHALL reject
a marker that is empty or consists of digits or separators.

#### Scenario: Marked amount

- **WHEN** the marker is "CR" and the cell is "113,83CR" with decimal comma
- **THEN** the amount is +11383 cents

#### Scenario: Unmarked amount

- **WHEN** the marker is "CR" and the cell is "59,00"
- **THEN** the amount is -5900 cents

#### Scenario: Marker with thousands separator

- **WHEN** the marker is "CR" and the cell is "1 979,73CR"
- **THEN** the amount is +197973 cents

#### Scenario: Flip applies after the marker

- **WHEN** the marker is "CR", flip-amount is on, and the cell is "113,83CR"
- **THEN** the amount is -11383 cents

#### Scenario: Invalid marker

- **WHEN** a source is posted with the marker "12"
- **THEN** the server responds 400 and does not store it

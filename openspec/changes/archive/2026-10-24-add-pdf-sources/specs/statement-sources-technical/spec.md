## MODIFIED Requirements

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

## ADDED Requirements

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

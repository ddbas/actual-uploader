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

## Purpose

Defines the server-side integration with Actual Budget: connecting with saved
settings, reporting status, and importing transactions.

## ADDED Requirements

### Requirement: Server Connects Using Saved Actual Settings

The server SHALL connect to Actual Budget using the stored server URL, server
password, sync ID, and (when set) encryption password, and SHALL read the
settings at the time of each operation so changes apply without a restart.

#### Scenario: Settings changed

- **WHEN** settings are updated and a later status check or upload occurs
- **THEN** the new settings are used

#### Scenario: Settings incomplete

- **WHEN** required settings are empty
- **THEN** the operation fails as "not connected" without contacting the network

### Requirement: Connection Status Endpoint

The server SHALL expose `GET /api/actual/status` returning
`{ connected: boolean, error?: string }`. It SHALL respond 200 in both cases,
SHALL NOT include secrets in `error`, and SHALL give up after a bounded timeout.

#### Scenario: Reachable and authenticated

- **WHEN** a client requests the status and the budget can be opened
- **THEN** the response is `{ "connected": true }`

#### Scenario: Failure

- **WHEN** the server is unreachable, the password is wrong, or the budget
  cannot be decrypted/opened
- **THEN** the response is `{ "connected": false, "error": "<message>" }`

### Requirement: Transaction Import Endpoint

The server SHALL expose `POST /api/actual/import` accepting
`{ transactions: Transaction[] }` and importing them via Actual's import
mechanism, grouped by `account`, returning `{ added: number, updated: number }`.
Invalid bodies SHALL yield 400; connection or import failures SHALL yield 502
with an `error` message. Changes SHALL be synced to the server before
responding.

#### Scenario: Successful import

- **WHEN** a valid transaction list is posted while connected
- **THEN** the transactions are imported, synced, and the counts returned

#### Scenario: Not connected

- **WHEN** the import is requested and the connection fails
- **THEN** the response is 502 with an error and nothing is reported as uploaded

### Requirement: Operations Against Actual Are Serialized

The server SHALL run Actual operations one at a time, because the Actual API
holds a single open budget per process, and SHALL shut the API down after each
operation.

#### Scenario: Concurrent requests

- **WHEN** a status check and an import arrive simultaneously
- **THEN** they execute sequentially and both complete correctly

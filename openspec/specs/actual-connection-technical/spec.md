# actual-connection-technical Specification

## Purpose

Defines the server-side integration with Actual Budget: connecting with saved
settings, reporting status, and importing transactions.

## Requirements

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
holds a single open budget per process. It SHALL keep the API session open
between operations and reuse it while the connection settings are unchanged. It
SHALL shut the session down when the settings change, when an operation fails or
times out, and after 5 minutes without use.

#### Scenario: Concurrent requests

- **WHEN** a status check and an import arrive simultaneously
- **THEN** they execute sequentially and both complete correctly

#### Scenario: Session reused

- **WHEN** several operations run in succession with unchanged settings
- **THEN** the server logs in to Actual once

#### Scenario: Settings changed

- **WHEN** the settings change between operations
- **THEN** the old session is shut down and a new one is opened

#### Scenario: Failure resets the session

- **WHEN** an operation fails
- **THEN** the session is shut down and the next operation opens a new one

### Requirement: Status Result Is Cached Briefly

The server SHALL reuse a status result for 15 seconds while the settings are
unchanged. Saving Actual settings SHALL discard the cached result.

#### Scenario: Repeated checks

- **WHEN** status is requested several times within 15 seconds
- **THEN** only one connection to Actual is made

#### Scenario: Settings saved

- **WHEN** settings are saved and status is requested
- **THEN** a fresh check is made

### Requirement: Backoff On Rate Limiting

When Actual answers a login with `too-many-requests`, the server SHALL make no
further Actual requests for 60 seconds. During that time every operation SHALL
fail immediately with a rate-limit error that includes the remaining seconds.
`GET /api/actual/status` SHALL still respond 200 with
`{ connected: false, error, retryAfterSeconds }`, and the import and accounts
endpoints SHALL respond 502 with `error` and `retryAfterSeconds`. Normal
operation SHALL resume after the cooldown.

#### Scenario: Rate limited

- **WHEN** Actual returns `too-many-requests`
- **THEN** the error reads "Actual is rate-limiting logins; retrying in N s."
  and later calls within 60 seconds make no network request

#### Scenario: Cooldown ends

- **WHEN** 60 seconds have passed
- **THEN** the next operation contacts Actual again

### Requirement: Account Listing Syncs With Actual First

Before returning accounts, `GET /api/accounts` SHALL pull the latest changes
from the Actual server into the open session, on every request, without logging
in again or re-downloading the budget. If the pull fails for a reason other than
rate limiting, the server SHALL log a warning and return the accounts already
held locally. Rate-limit failures SHALL follow the existing backoff behavior.

#### Scenario: Account added remotely while the session is open

- **WHEN** an account is created in Actual after the session opened and accounts
  are requested
- **THEN** the pull runs on the existing session and the response includes the
  new account

#### Scenario: Pull fails

- **WHEN** the pull fails with a non-rate-limit error
- **THEN** the response is 200 with the locally known accounts and a warning is
  logged

#### Scenario: No extra logins

- **WHEN** accounts are requested repeatedly with unchanged settings
- **THEN** the server logs in to Actual once

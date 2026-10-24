## MODIFIED Requirements

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

## ADDED Requirements

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

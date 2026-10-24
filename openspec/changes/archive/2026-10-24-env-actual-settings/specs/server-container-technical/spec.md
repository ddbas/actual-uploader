## ADDED Requirements

### Requirement: Actual Settings Via Environment

The server binary SHALL read the Actual connection settings from the environment
variables `ACTUAL_SERVER_URL`, `ACTUAL_SERVER_PASSWORD`, `ACTUAL_SYNC_ID` and
`ACTUAL_ENCRYPTION_PASSWORD`. An unset or empty variable SHALL count as not
provided. Provided values SHALL take precedence over saved values per field,
SHALL be applied to all Actual operations, and SHALL be held in memory only. The
variables SHALL NOT have defaults in the Docker image. Error messages shown to
users SHALL NOT contain environment-provided passwords.

#### Scenario: Settings from environment

- **WHEN** the binary is started with all three required variables set
- **THEN** the server connects to Actual using them without any saved settings

#### Scenario: Empty variable ignored

- **WHEN** `ACTUAL_ENCRYPTION_PASSWORD` is set to an empty string
- **THEN** it is treated as not provided

#### Scenario: Invalid server URL

- **WHEN** the binary is started with `ACTUAL_SERVER_URL=ftp://x`
- **THEN** it prints an error, does not start the server, and exits non-zero

#### Scenario: Partial environment

- **WHEN** only `ACTUAL_SERVER_URL` is set
- **THEN** the server starts and the remaining settings come from the saved
  settings

#### Scenario: Password not leaked in errors

- **WHEN** a connection fails with `ACTUAL_SERVER_PASSWORD` set
- **THEN** the reason shown to the user does not contain the password

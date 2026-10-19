## Purpose

Defines the technical requirements for persisting and exposing the Actual Budget
connection settings through the local server.

## Requirements

### Requirement: Actual Settings Are Persisted by the Server

The server SHALL persist Actual connection settings to `actual-settings.json` in
the same data directory used for sources, so they survive restarts. The data
directory SHALL be, in order of precedence: the value of the `--data-dir <path>`
command-line option of the binary when given, otherwise
`ACCOUNT_CRAWLER_DATA_DIR` when set, otherwise `~/.account-crawler`. When no
file path is configured (e.g. in tests) the server SHALL keep settings in memory
only. This file-based storage is a temporary approach and all persisted server
data SHALL follow it until a permanent storage solution replaces it.

#### Scenario: Settings survive restart

- **WHEN** settings are saved and the server is restarted with the same data
  directory
- **THEN** the saved settings are available again

#### Scenario: Default data directory

- **WHEN** neither `--data-dir` nor `ACCOUNT_CRAWLER_DATA_DIR` is set
- **THEN** settings are stored in `~/.account-crawler/actual-settings.json`

#### Scenario: Environment variable data directory

- **WHEN** `ACCOUNT_CRAWLER_DATA_DIR` is set and `--data-dir` is not given
- **THEN** settings are stored in `actual-settings.json` in that directory

#### Scenario: Command-line option overrides environment

- **WHEN** the binary is run with `--data-dir /tmp/x` and
  `ACCOUNT_CRAWLER_DATA_DIR` is also set
- **THEN** all persisted data is stored under `/tmp/x`

#### Scenario: Option given without a value

- **WHEN** the binary is run with `--data-dir` and no path
- **THEN** it prints an error, does not start the server, and exits non-zero

#### Scenario: Unknown argument

- **WHEN** the binary is run with an unrecognised argument
- **THEN** it prints a usage message, does not start the server, and exits
  non-zero

### Requirement: Actual Settings REST API

The server SHALL expose `GET /api/settings/actual` and
`PUT /api/settings/actual`. GET SHALL return the server URL, Sync ID, and for
each password a boolean indicating whether it is set, and SHALL NOT return
password values. PUT SHALL validate input and respond 400 with per-field errors
when invalid. An omitted password field in PUT SHALL leave the stored value
unchanged.

#### Scenario: GET before anything is saved

- **WHEN** a client requests `GET /api/settings/actual` with no saved settings
- **THEN** the response is 200 with empty values and password-set flags false

#### Scenario: GET never leaks secrets

- **WHEN** settings with passwords are saved and a client requests GET
- **THEN** the response contains only `hasPassword`-style booleans, not the
  password values

#### Scenario: PUT with invalid data

- **WHEN** a client sends PUT with a missing Sync ID or a non-http(s) URL
- **THEN** the response is 400 and nothing is stored

#### Scenario: PUT omitting a password

- **WHEN** a client sends a valid PUT without the password field after passwords
  were stored
- **THEN** the stored password is unchanged

### Requirement: Settings File Is Not World-Readable

The settings file containing secrets SHALL be written with owner-only
permissions (mode 0600).

#### Scenario: File permissions

- **WHEN** settings are saved to a file
- **THEN** the file mode permits access by the owner only

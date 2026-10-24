## Purpose

Defines the technical requirements for persisting and exposing the Actual Budget
connection settings through the local server.

## Requirements

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

### Requirement: Actual Settings Are Persisted in the Data Directory

The server SHALL persist Actual connection settings to `actual-settings.json` in
the same data directory used for sources, so they survive restarts. The data
directory SHALL be the value of the `DATA_DIR` environment variable when set and
non-empty, otherwise `~/.account-crawler`. The binary SHALL NOT accept a
command-line option for the data directory. When no file path is configured
(e.g. in tests) the server SHALL keep settings in memory only. This file-based
storage is a temporary approach and all persisted server data SHALL follow it
until a permanent storage solution replaces it.

#### Scenario: Settings survive restart

- **WHEN** settings are saved and the server is restarted with the same data
  directory
- **THEN** the saved settings are available again

#### Scenario: Default data directory

- **WHEN** `DATA_DIR` is not set
- **THEN** settings are stored in `~/.account-crawler/actual-settings.json`

#### Scenario: Environment variable data directory

- **WHEN** `DATA_DIR` is set to `/tmp/x`
- **THEN** all persisted data is stored under `/tmp/x`

#### Scenario: Empty environment variable

- **WHEN** `DATA_DIR` is set to an empty string
- **THEN** the default data directory is used

### Requirement: Locked Fields In Settings API

`GET /api/settings/actual` SHALL additionally return a `locked` object with a
boolean for each of `serverUrl`, `serverPassword`, `syncId` and
`encryptionPassword`, true when the field is provided by the environment. For
locked fields the returned values and password-set flags SHALL reflect the
environment value. `PUT /api/settings/actual` SHALL ignore locked fields in the
body, SHALL treat a locked required field as satisfied when validating, and
SHALL NOT persist environment-provided values.

#### Scenario: GET reports locked fields

- **WHEN** the server was started with `ACTUAL_SERVER_URL` set and a client
  requests `GET /api/settings/actual`
- **THEN** `locked.serverUrl` is true and the other fields are false

#### Scenario: PUT cannot change a locked field

- **WHEN** a client sends PUT with a different `serverUrl` while it is locked
- **THEN** the response is 200 and the environment value is still returned and
  used

#### Scenario: PUT omits locked required fields

- **WHEN** server URL and Sync ID are locked and a client sends PUT with only
  the server password
- **THEN** the response is 200 and the password is saved

#### Scenario: Environment values are not persisted

- **WHEN** settings are saved while some fields are environment-provided
- **THEN** `actual-settings.json` does not contain the environment values

## Purpose

Defines the technical requirements for persisting and exposing the Actual Budget
connection settings through the local server.

## ADDED Requirements

### Requirement: Actual Settings Are Persisted by the Server

The server SHALL persist Actual connection settings to a local JSON file
alongside other server data so they survive restarts, and SHALL work in memory
only when no file path is configured.

#### Scenario: Settings survive restart

- **WHEN** settings are saved and the server is restarted with the same file
- **THEN** the saved settings are available again

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

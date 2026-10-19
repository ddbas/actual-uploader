## MODIFIED Requirements

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

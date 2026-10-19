## REMOVED Requirements

### Requirement: Actual Settings Are Persisted by the Server

**Reason**: The data directory is no longer configurable through a command-line
option or `ACCOUNT_CRAWLER_DATA_DIR`; configuration is now environment-only.

**Migration**: Use the `DATA_DIR` environment variable. Replaced by "Actual
Settings Are Persisted in the Data Directory".

## ADDED Requirements

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

## ADDED Requirements

### Requirement: Environment-Provided Actual Settings Are Read-Only

When the server is started with a value for an Actual connection setting in its
environment, the Actual settings page SHALL show that field read-only. The
environment value SHALL take precedence over any value saved through the page.
Fields without an environment value SHALL remain editable, and saving SHALL only
affect those fields. Environment-provided passwords SHALL NOT be revealed.

#### Scenario: Field set by environment

- **WHEN** the server was started with a server URL in its environment and the
  user opens the Actual settings page
- **THEN** the server URL field shows that value, and is read-only

#### Scenario: Environment password stays hidden

- **WHEN** the server password comes from the environment
- **THEN** the field is read-only, indicates a value is set, and does not reveal
  it

#### Scenario: Partial environment

- **WHEN** only the server URL and Sync ID come from the environment
- **THEN** those fields are read-only and the user can still enter and save the
  server password and encryption password

#### Scenario: Environment overrides saved value

- **WHEN** the user previously saved a Sync ID and the server is now started
  with a different Sync ID in its environment
- **THEN** the environment Sync ID is shown and used

#### Scenario: Fully environment-configured

- **WHEN** all three required settings come from the environment
- **THEN** the page shows every provided field read-only, the connection status
  uses those values, and nothing needs to be entered

#### Scenario: Environment value removed

- **WHEN** the server is restarted without an environment value that was
  previously set
- **THEN** that field is editable again and shows any value previously saved
  through the page

## Purpose

Defines the dashboard Settings tab, which hosts multiple settings pages, and the
Actual settings page where the user configures their Actual Budget server
connection.

## Requirements

### Requirement: Settings Tab With Multiple Pages

The dashboard SHALL present a "Settings" tab, always visible, containing a
navigation between settings pages. The pages SHALL initially be "Actual" and
"Sources", and the first page ("Actual") SHALL be selected when the tab is
opened.

#### Scenario: Opening Settings

- **WHEN** the user opens the "Settings" tab
- **THEN** a navigation listing "Actual" and "Sources" is shown and the "Actual"
  page is selected

#### Scenario: Switching pages

- **WHEN** the user selects "Actual" in the settings navigation
- **THEN** the Actual settings page is shown and the "Actual" entry is marked
  selected

### Requirement: Actual Settings Page Collects Server Connection Details

The "Actual" settings page SHALL let the user enter and save the following
Actual Budget connection details: server URL (required), server password
(required), budget Sync ID (required), and end-to-end encryption password
(optional).

#### Scenario: Saving valid settings

- **WHEN** the user fills in the server URL, server password and Sync ID and
  clicks "Save"
- **THEN** the settings are saved and a confirmation is shown

#### Scenario: Settings are shown after reload

- **WHEN** the user has saved Actual settings and reopens the page
- **THEN** the server URL, Sync ID are pre-filled, and the password fields
  indicate a value is set without revealing it

#### Scenario: Required fields missing

- **WHEN** the user clicks "Save" with the server URL, server password or Sync
  ID empty
- **THEN** nothing is saved and each missing field shows an error

#### Scenario: Invalid server URL

- **WHEN** the user enters a server URL that is not a valid http or https URL
  and clicks "Save"
- **THEN** nothing is saved and the URL field shows an error

#### Scenario: Keeping an existing password

- **WHEN** settings were previously saved and the user saves again leaving a
  password field untouched
- **THEN** the previously saved password is kept

### Requirement: Secrets Are Masked

Password fields on the Actual settings page SHALL be masked while typing and
SHALL NOT display previously saved values.

#### Scenario: Password input is masked

- **WHEN** the user types into the server password field
- **THEN** the characters are not displayed in clear text

### Requirement: Settings Navigation Adapts To Narrow Viewports

On narrow viewports (phones) the settings navigation SHALL NOT sit beside the
page content; it SHALL be presented as a single select control above the content
that lists every settings page and shows the current one. On wider viewports it
SHALL remain a side navigation. Both presentations SHALL list the same pages and
select the same one.

#### Scenario: Switching pages on a phone

- **WHEN** the viewport is narrow and the user chooses "Sources" in the settings
  select
- **THEN** the Sources settings page is shown at the full available width

#### Scenario: Content gets the full width on a phone

- **WHEN** the user opens the "Settings" tab on a narrow viewport
- **THEN** the selected settings page uses the full width of the screen and is
  not shown beside a navigation

#### Scenario: Wide viewport unchanged

- **WHEN** the user opens the "Settings" tab on a wide viewport
- **THEN** the navigation is shown to the left of the selected page

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

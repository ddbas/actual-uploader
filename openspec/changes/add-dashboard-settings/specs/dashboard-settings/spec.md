## Purpose

Defines the dashboard Settings tab, which hosts multiple settings pages, and the
Actual settings page where the user configures their Actual Budget server
connection.

## ADDED Requirements

### Requirement: Settings Tab With Multiple Pages

The dashboard SHALL present a "Settings" tab, always visible, containing a
navigation between settings pages. The pages SHALL initially be "Sources" and
"Actual", and the first page ("Sources") SHALL be selected when the tab is
opened.

#### Scenario: Opening Settings

- **WHEN** the user opens the "Settings" tab
- **THEN** a navigation listing "Sources" and "Actual" is shown and the
  "Sources" page is selected

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

## MODIFIED Requirements

### Requirement: Sources Tab

The dashboard SHALL present a "Sources" page within the "Settings" tab, listing
every saved source by name and format, with a button to create a new one and a
control to delete an existing one. The dashboard SHALL NOT present a separate
top-level "Sources" tab.

#### Scenario: Tab lists saved sources

- **WHEN** the user opens the "Sources" page under "Settings"
- **THEN** each saved source is listed with its name and file format

#### Scenario: Empty state

- **WHEN** no sources exist
- **THEN** the page shows a message inviting the user to create one

#### Scenario: No top-level Sources tab

- **WHEN** the dashboard loads
- **THEN** the top-level tab bar does not contain a "Sources" tab

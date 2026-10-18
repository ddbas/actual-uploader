# actual-connection Specification

## Purpose

Defines how the dashboard tells the user whether it can currently reach their
Actual Budget server using the saved Settings.

## Requirements

### Requirement: Connection Status Indicator in Header

The dashboard SHALL show, in the page header visible on every tab, an indicator
of whether a connection to Actual Budget using the saved settings works. When
connected it SHALL show a pulsating green circle with the word "Connected". When
not connected it SHALL show a red, non-pulsating circle with the words "Not
connected".

#### Scenario: Connection works

- **WHEN** the dashboard loads and the server can connect to Actual Budget
- **THEN** the header shows a pulsating green circle and "Connected"

#### Scenario: Connection fails

- **WHEN** the connection fails or the settings are incomplete
- **THEN** the header shows a red circle that does not pulsate and "Not
  connected"

#### Scenario: Checking state

- **WHEN** the status check is still in progress
- **THEN** the indicator shows a neutral "Checking…" state rather than red or
  green

### Requirement: Status Refreshes After Settings Change

The indicator SHALL re-check the connection after the user saves Actual
settings, and SHALL periodically re-check while the dashboard is open.

#### Scenario: User fixes settings

- **WHEN** the user saves corrected Actual settings
- **THEN** the indicator updates to reflect the new connection result without a
  page reload

### Requirement: Not Connected Reason Is Available

When not connected, the indicator SHALL expose a short reason (for example,
wrong password or unreachable server) to the user, such as via a tooltip.

#### Scenario: Reason shown

- **WHEN** the connection fails and the user hovers the indicator
- **THEN** the failure reason is displayed

## MODIFIED Requirements

### Requirement: Status Refreshes After Settings Change

The indicator SHALL re-check the connection after the user saves Actual
settings, and SHALL periodically re-check while the dashboard is open and
visible, no more often than once a minute. It SHALL NOT poll while the page is
hidden, and SHALL re-check when the page becomes visible again. When the server
reports a wait time, the dashboard SHALL NOT re-check sooner than that.

#### Scenario: User fixes settings

- **WHEN** the user saves corrected Actual settings
- **THEN** the indicator updates to reflect the new connection result without a
  page reload

#### Scenario: Tab hidden

- **WHEN** the dashboard tab is in the background
- **THEN** no periodic status checks are made until it is visible again

## ADDED Requirements

### Requirement: Rate-Limit Reason Is Explained

When Actual is rejecting logins because of rate limiting, the "Not connected"
reason SHALL say so and how long until the next attempt, instead of showing a
raw error code.

#### Scenario: Rate limited

- **WHEN** Actual responds that too many requests were made
- **THEN** the tooltip reads "Actual is rate-limiting logins; retrying in N s."

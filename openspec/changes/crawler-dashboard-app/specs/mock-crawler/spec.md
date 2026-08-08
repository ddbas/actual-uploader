## ADDED Requirements

### Requirement: Mock Crawler Is Available to Run

The system SHALL provide a `mock` crawler that behaves like a real account
crawler from the user's perspective, serving as the default example crawler
users see and run before any real bank crawler exists.

#### Scenario: Mock crawler is discoverable

- **WHEN** the dashboard requests the list of available crawlers
- **THEN** the `mock` crawler appears in the list with a name and description

### Requirement: Mock Crawler Simulates a Bank Login Session

Running the mock crawler SHALL open a browser session to a real bank
authentication page, remain on that page briefly to simulate a login
interaction, then close the session, without attempting to actually
authenticate.

#### Scenario: Mock crawler opens and closes a browser session

- **WHEN** the user runs the mock crawler
- **THEN** a browser session opens to the bank's authentication page, stays open
  for approximately 5 seconds, and then closes before the run completes

### Requirement: Mock Crawler Produces Sample Transaction Data

After its simulated login session ends, the mock crawler SHALL produce a small,
fixed set of sample transactions so users can see what collected transaction
data looks like end-to-end.

#### Scenario: Mock crawler produces transactions after its session ends

- **WHEN** the mock crawler's simulated login session has closed
- **THEN** the crawler produces one or more sample transactions, each with at
  least an account, a date, and an amount, and the run then completes

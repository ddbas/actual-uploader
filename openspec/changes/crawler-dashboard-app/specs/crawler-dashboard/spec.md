## ADDED Requirements

### Requirement: Running the Binary Opens the Dashboard Automatically

The system SHALL provide a binary that, when run, automatically opens the
dashboard in the user's default browser without requiring the user to manually
navigate to a URL.

#### Scenario: User starts the binary

- **WHEN** the user runs the binary
- **THEN** the user's default browser opens automatically to the dashboard,
  ready for the user to view and interact with

### Requirement: Home Tab Lists Crawlers With Run Controls

The dashboard SHALL present a "Home" tab, active by default, listing every
registered crawler with its name, description, and a "Run" button, plus a single
"Run All" button positioned above the list of crawlers.

#### Scenario: Home tab is the initial view

- **WHEN** the dashboard first loads in the browser
- **THEN** the "Home" tab is shown and selected by default

#### Scenario: Home tab lists all registered crawlers

- **WHEN** the "Home" tab is displayed
- **THEN** every registered crawler is listed with its name, description, and a
  "Run" button, and a "Run All" button is shown above the list

### Requirement: Running an Individual Crawler

Clicking a crawler's "Run" button SHALL start only that crawler's run and SHALL
NOT affect the run state of any other crawler.

#### Scenario: User runs a single crawler

- **WHEN** the user clicks the "Run" button next to a specific crawler
- **THEN** only that crawler begins running, and the other crawlers' run states
  remain unchanged

### Requirement: Running All Crawlers in Series

Clicking "Run All" SHALL run every registered crawler one after another (in
series), starting the next crawler only after the previous one has finished or
failed.

#### Scenario: User clicks Run All

- **WHEN** the user clicks the "Run All" button
- **THEN** each registered crawler runs to completion (or failure) before the
  next crawler starts, until all crawlers have been run

### Requirement: Per-Crawler Progress Indicator

While a crawler is running, the Home tab SHALL display a progress indicator next
to that crawler that reflects its current running state.

#### Scenario: Progress indicator shown while running

- **WHEN** a crawler is currently running (individually or as part of "Run All")
- **THEN** a progress indicator is displayed next to that crawler's entry

#### Scenario: Progress indicator cleared when finished

- **WHEN** a crawler's run finishes (successfully or with an error)
- **THEN** the progress indicator for that crawler is no longer shown as
  "running", and the outcome (success or failure) is reflected in the UI

### Requirement: Results Tab Appears After a Run Completes

A "Results" tab SHALL NOT be visible before any crawler run has completed. As
soon as at least one crawler run finishes, the "Results" tab SHALL appear and
SHALL be populated with the transaction data collected so far.

#### Scenario: No Results tab before any run

- **WHEN** the dashboard is loaded and no crawler has been run yet
- **THEN** only the "Home" tab is visible; the "Results" tab is not shown

#### Scenario: Results tab appears after first completed run

- **WHEN** any single crawler run completes (whether run individually or as part
  of "Run All")
- **THEN** the "Results" tab becomes visible and is populated with the
  transactions collected by that crawler

#### Scenario: Results tab streams in additional transactions

- **WHEN** a crawler yields additional transactions while running, and the
  "Results" tab is visible
- **THEN** those transactions are added to the Results tab as they are received,
  without requiring a page reload

### Requirement: Results Tab Aggregates Transactions Across Runs

The "Results" tab SHALL display transaction data collected across all crawler
runs performed during the current session, including from "Run All" executions.

#### Scenario: Results include transactions from multiple crawlers

- **WHEN** more than one crawler has completed a run during the current session
- **THEN** the "Results" tab shows the transactions collected from all of those
  completed runs

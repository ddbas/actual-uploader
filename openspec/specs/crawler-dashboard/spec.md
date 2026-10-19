## Purpose

Defines the functional requirements for the dashboard application: a locally
launched UI where users upload statement files for a source, review the parsed
transactions, and confirm them for upload to Actual Budget.

## Requirements

### Requirement: Running the Binary Opens the Dashboard Automatically

The system SHALL provide a binary that, when run, automatically opens the
dashboard in the user's default browser without requiring the user to manually
navigate to a URL.

#### Scenario: User starts the binary

- **WHEN** the user runs the binary
- **THEN** the user's default browser opens automatically to the dashboard,
  ready for the user to view and interact with

### Requirement: Upload Tab Is the Default View

The dashboard SHALL present an "Upload" tab, active by default.

#### Scenario: Upload is the initial view

- **WHEN** the dashboard first loads
- **THEN** the "Upload" tab is shown and selected

### Requirement: Upload Statement Files For a Source

The Upload tab SHALL let the user choose a source, enter an account, and select
one or more files, which are processed using that source.

#### Scenario: Files are processed

- **WHEN** the user picks a source, account and files and submits
- **THEN** each file is processed with the source and the resulting transactions
  are shown for review, along with any rows that were skipped

### Requirement: Confirm Before Uploading to Actual

The user SHALL confirm the reviewed transactions before they are uploaded to
Actual Budget. On confirmation the transactions SHALL actually be imported into
Actual Budget using the saved settings, and the result SHALL be reported.

#### Scenario: User confirms

- **WHEN** the user clicks "Upload to Actual" on the review step
- **THEN** the transactions are imported into Actual Budget and a message
  confirms how many were uploaded

#### Scenario: Upload fails

- **WHEN** the user clicks "Upload to Actual" and the upload fails
- **THEN** an error message with the reason is shown, the reviewed transactions
  remain on screen, and the user can retry

#### Scenario: In progress

- **WHEN** an upload is in progress
- **THEN** the upload button is disabled and shows "Uploading…"

### Requirement: Account Is Chosen From Actual Budget Accounts

The Upload tab SHALL present the account as a select listing the accounts
available in Actual Budget, showing each account's name and using its ID as the
value applied to the processed transactions.

#### Scenario: User picks an account by name

- **WHEN** the user opens the account select on the Upload tab
- **THEN** each available account is listed by name, and the chosen account's ID
  is used as the `account` of the processed transactions

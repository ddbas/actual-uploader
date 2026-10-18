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
Actual Budget. Until the Actual integration exists, confirming only displays a
message that the transactions were uploaded.

#### Scenario: User confirms

- **WHEN** the user clicks "Upload to Actual" on the review step
- **THEN** a message confirms how many transactions were uploaded

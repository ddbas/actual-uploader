## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Home Tab Lists Crawlers With Run Controls

The dashboard SHALL present a "Crawlers" tab listing every registered crawler
with its name, description, and a "Run" button, plus a single "Run All" button
positioned above the list of crawlers.

#### Scenario: Home tab is the initial view

- **WHEN** the dashboard first loads in the browser
- **THEN** the "Upload" tab is shown and selected by default (the former "Home"
  tab is now "Crawlers")

#### Scenario: Home tab lists all registered crawlers

- **WHEN** the "Crawlers" tab is displayed
- **THEN** every registered crawler is listed with its name, description, and a
  "Run" button, and a "Run All" button is shown above the list

#### Scenario: Crawlers tab lists all registered crawlers

- **WHEN** the "Crawlers" tab is displayed
- **THEN** every registered crawler is listed with its name, description, and a
  "Run" button, and a "Run All" button is shown above the list

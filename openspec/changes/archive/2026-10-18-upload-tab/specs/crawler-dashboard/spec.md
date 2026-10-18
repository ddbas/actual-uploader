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

## REMOVED Requirements

### Requirement: Home Tab Lists Crawlers With Run Controls

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

### Requirement: Running an Individual Crawler

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

### Requirement: Running All Crawlers in Series

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

### Requirement: Per-Crawler Progress Indicator

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

### Requirement: Results Tab Appears After a Run Completes

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

### Requirement: Results Tab Aggregates Transactions Across Runs

**Reason**: Web crawlers are no longer used to collect transaction data.

**Migration**: None; transactions now come from uploaded statement files.

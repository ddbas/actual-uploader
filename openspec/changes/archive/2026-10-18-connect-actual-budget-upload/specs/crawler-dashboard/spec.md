## MODIFIED Requirements

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

## MODIFIED Requirements

### Requirement: Upload Statement Files For a Source

The Upload tab SHALL let the user choose a source, enter an account, and select
one or more files, which are processed using that source. The files accepted
SHALL match the chosen source's format (CSV or PDF). Any warnings reported while
processing a file SHALL be shown with its results.

#### Scenario: Files are processed

- **WHEN** the user picks a source, account and files and submits
- **THEN** each file is processed with the source and the resulting transactions
  are shown for review, along with any rows that were skipped

#### Scenario: PDF source accepts PDFs

- **WHEN** the user chooses a PDF source
- **THEN** the file picker accepts PDF files, and each is processed with the
  source

#### Scenario: Warnings are shown

- **WHEN** processing a file returns a warning such as "no transactions found"
- **THEN** the warning is shown with that file's results so the user can see why
  nothing was found, and nothing is imported for it

#### Scenario: Unreadable PDF

- **WHEN** a PDF cannot be read (not a PDF, password-protected or without text)
- **THEN** an error naming the reason is shown for that file

## ADDED Requirements

### Requirement: Upload Types Tab

The dashboard SHALL present an "Upload Types" tab, always visible, listing every
saved upload type by name and format, with a button to create a new one and a
control to delete an existing one.

#### Scenario: Tab lists saved upload types

- **WHEN** the user opens the "Upload Types" tab
- **THEN** each saved upload type is listed with its name and file format

#### Scenario: Empty state

- **WHEN** no upload types exist
- **THEN** the tab shows a message inviting the user to create one

### Requirement: Guided CSV Upload Type Creation

The dashboard SHALL guide the user through creating a CSV upload type: naming
it, uploading an example CSV file, indicating whether the first row is a header,
and assigning a source column to each transaction field.

#### Scenario: Example file preview

- **WHEN** the user uploads an example CSV
- **THEN** the dashboard shows a preview of its first rows, using the header row
  for column labels when the user indicates a header exists

#### Scenario: Header row is ignored

- **WHEN** the user indicates the file starts with a header
- **THEN** the header row is excluded from transaction data

#### Scenario: Per-column field selection

- **WHEN** the example file is previewed
- **THEN** each column has a select letting the user choose which transaction
  field it represents (date, amount, payee, notes, source id) or ignore it, and
  the user can also choose a date format and decimal separator

#### Scenario: Each field is used at most once

- **WHEN** a field is selected for one column
- **THEN** that field is no longer offered in the selects of the other columns,
  until it is deselected

#### Scenario: Split debit/credit amounts

- **WHEN** the institution reports amounts in separate debit and credit columns
- **THEN** the user can choose "separate debit and credit columns" and pick both

### Requirement: Mapping Is Guessed From the Example File

When an example file is loaded (or its parsing options change), the dashboard
SHALL propose a mapping by inspecting header names and the shape of the first
data row, pre-select the detected date format and decimal separator, and let the
user change any of it.

#### Scenario: Columns are pre-assigned

- **WHEN** the user uploads a CSV whose header contains "Date", "Description",
  "Debit" and "Credit"
- **THEN** those columns are pre-assigned to date, payee, debit and credit, and
  the amount layout is set to separate debit and credit columns

#### Scenario: Date format is detected

- **WHEN** the date column's first value is "2024-01-05"
- **THEN** the date format "YYYY MM DD" is pre-selected

### Requirement: File and Amount Options

The dashboard SHALL let the user set the delimiter, skip a number of lines at
the start and end of the file, flip the sign of amounts, and choose an amount
layout: a single signed column, separate debit and credit columns, or an amount
column plus an in/out column (with the value that marks money going out).

#### Scenario: In/out layout

- **WHEN** the user chooses the in/out layout
- **THEN** the per-column selects offer "Amount" and "In/Out", and saving
  requires both plus the out value

#### Scenario: Skipped lines

- **WHEN** the user skips lines at the start of the file
- **THEN** those lines are excluded from the preview, and the header (if any) is
  taken from the first line after them

### Requirement: Required Fields Must Be Mapped Before Saving

An upload type SHALL NOT be savable until it has a name and a source for every
required transaction field: date and amount.

#### Scenario: Save blocked while incomplete

- **WHEN** a required field has no source column
- **THEN** the save action is disabled and the missing fields are indicated

#### Scenario: Save succeeds when complete

- **WHEN** all required fields are mapped and the user saves
- **THEN** the upload type appears in the list and is available for processing
  statements

### Requirement: Mapped Preview of Transactions

Before saving, the dashboard SHALL show the example file's rows interpreted as
transactions so the user can verify the mapping, showing each date as its raw
value and parsed result, and flagging dates and amounts that fail to parse.

#### Scenario: Preview reflects mapping

- **WHEN** the user changes a column assignment
- **THEN** the transaction preview updates immediately

#### Scenario: Unparseable values are flagged

- **WHEN** a date or amount cell cannot be parsed
- **THEN** the preview shows "Invalid" for it

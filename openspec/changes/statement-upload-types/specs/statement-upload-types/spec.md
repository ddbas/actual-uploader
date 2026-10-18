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

#### Scenario: Field mapping

- **WHEN** the user is mapping fields
- **THEN** they can choose a column for date, amount, payee, notes, and source
  id, and choose a date format and decimal separator

#### Scenario: Split debit/credit amounts

- **WHEN** the institution reports amounts in separate debit and credit columns
- **THEN** the user can choose "separate debit and credit columns" and pick both

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
transactions so the user can verify the mapping, flagging rows that fail to
parse.

#### Scenario: Preview reflects mapping

- **WHEN** the user changes a column assignment
- **THEN** the transaction preview updates immediately

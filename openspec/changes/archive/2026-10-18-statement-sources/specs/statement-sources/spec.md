## ADDED Requirements

### Requirement: Sources Tab

The dashboard SHALL present an "Sources" tab, always visible, listing every
saved source by name and format, with a button to create a new one and a control
to delete an existing one.

#### Scenario: Tab lists saved sources

- **WHEN** the user opens the "Sources" tab
- **THEN** each saved source is listed with its name and file format

#### Scenario: Empty state

- **WHEN** no sources exist
- **THEN** the tab shows a message inviting the user to create one

### Requirement: Confirm Before Deleting a Source

The dashboard SHALL NOT delete a source immediately when the user activates its
delete control. It SHALL first ask the user to confirm, naming the source and
stating that the deletion cannot be undone, and SHALL delete only on explicit
confirmation.

#### Scenario: Delete confirmed

- **WHEN** the user activates a source's delete control and then confirms
- **THEN** the source is deleted and removed from the list

#### Scenario: Delete cancelled

- **WHEN** the user activates a source's delete control and then cancels
- **THEN** the source is not deleted and remains in the list

### Requirement: Guided CSV Source Creation

The dashboard SHALL guide the user through creating a CSV source: naming it,
uploading an example CSV file, indicating whether the first row is a header, and
assigning a source column to each transaction field.

#### Scenario: Example file preview

- **WHEN** the user uploads an example CSV
- **THEN** the dashboard shows a preview of its first rows, using the header row
  for column labels when the user indicates a header exists

#### Scenario: Header row is ignored

- **WHEN** the user indicates the file starts with a header
- **THEN** the header row is excluded from transaction data

#### Scenario: Field-to-column selection

- **WHEN** the example file has been loaded
- **THEN** a section separate from the preview table shows one select per
  transaction field (date, payee, notes, transaction ID, and the amount fields
  for the chosen layout), each listing the file's columns (by header name, or by
  column number and sample value when there is no header), and the user can also
  choose a date format and decimal separator

#### Scenario: Columns that cannot supply a field are not offered

- **WHEN** the field selects are populated
- **THEN** columns with no values in any sample row are never offered, the date
  select offers only columns whose values look like dates, and the amount,
  outflow and inflow selects offer only columns whose values look like amounts

#### Scenario: Options are named recognizably

- **WHEN** a column is listed in a field select
- **THEN** it is labelled with its header (or "Column N" without a header)
  followed by its first non-empty value, and duplicate header names also show
  their column number

#### Scenario: Each column feeds at most one field

- **WHEN** the same column is selected for more than one field
- **THEN** the form indicates which fields share the column and the save action
  is disabled until each column is used by at most one field; columns already
  selected for another field remain offered in every select

#### Scenario: Preview columns are the fields

- **WHEN** the mapping changes
- **THEN** the preview table, whose columns are the transaction fields rather
  than the file's columns, immediately shows each sample row's values as
  selected by the current mapping

#### Scenario: Split outflow/inflow amounts

- **WHEN** the user checks "Split amount into separate inflow/outflow columns"
- **THEN** the field selects offer "Outflow" and "Inflow" instead of "Amount",
  both are required, and the preview shows separate Outflow and Inflow columns

#### Scenario: Delimiter

- **WHEN** an example file is loaded
- **THEN** its delimiter (comma, semicolon, tab, pipe, or tilde) is detected and
  pre-selected, and the user can change it

#### Scenario: Date format labels use the file's separator

- **WHEN** the date format select is shown and the sample date uses a separator
- **THEN** the format options are labelled with that separator (e.g.
  "DD/MM/YYYY")

### Requirement: Mapping Is Guessed From the Example File

When an example file is loaded (or its parsing options change), the dashboard
SHALL propose a mapping by inspecting header names and the shape of the first
data row, pre-select the detected date format and decimal separator, and let the
user change any of it.

#### Scenario: Columns are pre-assigned

- **WHEN** the user uploads a CSV whose header contains "Date", "Description",
  "Debit" and "Credit"
- **THEN** those columns are pre-assigned to date, payee, outflow and inflow,
  and the split amount layout is enabled

#### Scenario: Payee is detected from values

- **WHEN** no header identifies the payee
- **THEN** the leftover text column that looks most like merchant names (mostly
  letters, varied across rows, reasonably long) is pre-assigned to payee, while
  account-number columns and repeating status columns (e.g. "Debit"/"Credit")
  are not

#### Scenario: Amount prefers columns with cents

- **WHEN** no header identifies the amount and several columns hold numbers
- **THEN** a column whose values have cents (e.g. "-4.50") is preferred over
  integer-only columns such as account numbers

#### Scenario: Decimal separator is guessed

- **WHEN** the amount values use a decimal comma (e.g. "12,50") and none use a
  decimal point
- **THEN** the decimal separator is pre-set to comma

#### Scenario: Date format is detected from all sample rows

- **WHEN** the date column's values are "05/03/2024" and "31/03/2024"
- **THEN** the format "DD MM YYYY" is pre-selected, because every sample row is
  considered and "31" rules out a month-first format

#### Scenario: Ambiguous date format is flagged

- **WHEN** more than one date format fits every sample date
- **THEN** the first is pre-selected and the dashboard lists the other formats
  that also fit, advising the user to check the preview

#### Scenario: Format is re-detected when the date column changes

- **WHEN** the user selects a different column for the date field
- **THEN** the date format is detected again from that column's values

### Requirement: File and Amount Options

The dashboard SHALL let the user set the delimiter, skip a number of lines at
the start and end of the file, flip the sign of amounts, and choose an amount
layout via checkboxes: a single signed column (default), separate outflow and
inflow columns, or an amount column plus an in/out column (with the value that
marks money going out).

#### Scenario: In/out layout

- **WHEN** the user chooses the in/out layout
- **THEN** the field selects offer "Amount" and "In/Out", and saving requires
  both plus the out value

#### Scenario: Skipped lines

- **WHEN** the user skips lines at the start of the file
- **THEN** those lines are excluded from the preview, and the header (if any) is
  taken from the first line after them

### Requirement: Required Fields Must Be Mapped Before Saving

A source SHALL NOT be savable until it has a name and a column for every
required transaction field: the date, plus the amount fields of the chosen
layout (amount; outflow and inflow; or amount and in/out column with an out
value).

#### Scenario: Save blocked while incomplete

- **WHEN** a required field has no source column
- **THEN** the save action is disabled and the missing fields are indicated

#### Scenario: Save succeeds when complete

- **WHEN** all required fields are mapped and the user saves
- **THEN** the source appears in the list and is available for processing
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

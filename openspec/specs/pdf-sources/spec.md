# pdf-sources Specification

## Purpose

Lets users create sources for PDF statements: they upload an example PDF, pick
an extraction approach, show the dashboard where the transaction table is, map
its columns to transaction fields, and preview the result before saving.

## Requirements

### Requirement: Source Format Choice

When creating a source the dashboard SHALL let the user choose the statement
file format, CSV or PDF, and SHALL present the setup steps for the chosen
format.

#### Scenario: Choosing PDF

- **WHEN** the user starts a new source and chooses the PDF format
- **THEN** the dashboard asks for a name and an example PDF and shows the PDF
  setup steps instead of the CSV ones

#### Scenario: Choosing CSV

- **WHEN** the user chooses the CSV format
- **THEN** the existing CSV setup is shown unchanged

### Requirement: Example PDF Upload and Page Display

For a PDF source the dashboard SHALL let the user upload an example PDF and
SHALL display its pages visually, one at a time, with controls to move between
pages.

#### Scenario: Pages are shown

- **WHEN** the user uploads an example PDF with several pages
- **THEN** the first page is displayed and the user can move to the other pages

#### Scenario: PDF without readable text

- **WHEN** the user uploads a PDF that contains no text (for example a scan)
- **THEN** the dashboard explains that the PDF has no readable text and that
  scanned PDFs are not supported, and does not offer the setup steps

#### Scenario: Password-protected PDF

- **WHEN** the user uploads a password-protected PDF
- **THEN** the dashboard explains that the PDF is password-protected and cannot
  be read

### Requirement: Extraction Approach Selection

The dashboard SHALL present a select listing the available extraction approaches
for PDF sources, and SHALL show the setup controls of the selected approach. The
user SHALL be able to switch between approaches while setting up a source, and
settings made in an approach SHALL be remembered while the user switches away
from it and back.

#### Scenario: Approach select

- **WHEN** the PDF setup is shown
- **THEN** a select lists the available approaches by name, with "Aligned
  columns" selected by default

#### Scenario: Settings are remembered across switches

- **WHEN** the user configures one approach, switches to another approach, then
  switches back
- **THEN** the first approach's settings are restored as they were left

#### Scenario: Preview follows the selected approach

- **WHEN** the user selects an approach
- **THEN** the transaction preview shows what that approach, with its current
  settings, extracts from the example PDF

#### Scenario: Saved source remembers its approach

- **WHEN** the user saves a PDF source
- **THEN** the source records the selected approach and its settings, and later
  uploads for that source are processed with them

### Requirement: Aligned Columns Approach

The "Aligned columns" approach SHALL treat text that is lined up in columns as a
table. The dashboard SHALL let the user place, move and remove vertical column
dividers over the displayed page, pre-suggesting dividers from the positions of
the text. The dividers SHALL apply to every page of the PDF. Text between
consecutive dividers on the same line SHALL form one cell. Where two dividers
are not placed between pieces of text, those pieces SHALL be read as one cell.

#### Scenario: Dividers are suggested

- **WHEN** the user uploads an example PDF and selects Aligned columns
- **THEN** dividers are pre-placed between the aligned groups of text, and the
  user can add, move or remove any of them

#### Scenario: Dividers apply to all pages

- **WHEN** the user places a divider on one page
- **THEN** it is shown at the same position on every page and applies to every
  page when extracting

#### Scenario: Merging cells

- **WHEN** the user removes the divider between two adjacent text groups (for
  example a day and a month)
- **THEN** the two groups are read as a single cell

#### Scenario: Wrapped words stay together

- **WHEN** the words of a description are separated only by ordinary spaces
- **THEN** they are read as one piece of text in one cell

### Requirement: Rows Begin With a Date

With the Aligned columns approach, a line SHALL become a row of the extracted
table only when its cell in the chosen date column is a date. Lines that do not
begin with a date, such as headings, page headers and footers, totals and
wrapped text, SHALL be ignored.

#### Scenario: Non-date lines are ignored

- **WHEN** a page contains headings, a totals line and a page footer around the
  transaction lines
- **THEN** only the lines whose date cell is a date become rows

#### Scenario: Rows span pages and tables

- **WHEN** the transaction lines continue on a following page, or the PDF
  contains several tables with the same column positions
- **THEN** all their rows are extracted in document order

### Requirement: Columns Are Mapped to Fields Like CSV

After the dividers are placed, the dashboard SHALL present the extracted columns
and let the user assign them to transaction fields, with the same controls and
rules as the CSV source setup: date, payee, notes, transaction ID, the amount
layouts, the date format, the decimal separator, flipping the sign of amounts,
and the credit marker. The dashboard SHALL propose an initial mapping from the
extracted values. A source SHALL NOT be savable until it has a name and every
required field is mapped.

#### Scenario: Same mapping controls as CSV

- **WHEN** the user has placed the dividers
- **THEN** the dashboard shows a select per transaction field listing the
  extracted columns, and the amount layout options

#### Scenario: Mapping is guessed

- **WHEN** the extracted columns contain a date-like column and an amount-like
  column
- **THEN** they are pre-assigned to date and amount

#### Scenario: Save blocked while incomplete

- **WHEN** a required field has no column
- **THEN** the save action is disabled and the missing fields are indicated

#### Scenario: Each column feeds at most one field

- **WHEN** the same column is selected for more than one field
- **THEN** the save action is disabled until each column is used by at most one
  field

### Requirement: Dates With or Without a Year

The date format options for PDF sources SHALL include formats without a year in
addition to the existing formats. When the chosen date column contains a year,
the dashboard SHALL use it. When it does not, the dashboard SHALL require the
user to click, on the displayed page, the text that contains the year, and the
source SHALL NOT be savable until they have.

#### Scenario: Date with a year

- **WHEN** the date column contains values such as "2026-09-03"
- **THEN** no year selection is requested

#### Scenario: Date without a year

- **WHEN** the date column contains values such as "03 09" with no year
- **THEN** the dashboard asks the user to click the text containing the year on
  the displayed page, and the save action is disabled until they do

#### Scenario: Year is chosen by clicking

- **WHEN** the user clicks a piece of text on the page that contains a year
- **THEN** the year is shown as selected, highlighted on the page, and used for
  the preview

#### Scenario: Clicked text has no year

- **WHEN** the user clicks text that does not contain a year
- **THEN** it is not accepted and the user is told why

#### Scenario: Year rolls over

- **WHEN** the rows run from December into January and the clicked year is the
  later one
- **THEN** the December rows are dated in the previous year and the January rows
  in the clicked year

### Requirement: Mapped Preview of PDF Transactions

Before saving, the dashboard SHALL show the example PDF's extracted rows
interpreted as transactions, with each date as its raw text and parsed result
and unparseable dates and amounts flagged, updating as the user changes the
approach, dividers or mapping. The preview SHALL match what uploading the same
PDF to the saved source produces.

#### Scenario: Preview updates

- **WHEN** the user moves a divider or changes a column assignment
- **THEN** the transaction preview updates immediately

#### Scenario: Unparseable values are flagged

- **WHEN** a date or amount cell cannot be parsed
- **THEN** the preview shows "Invalid" for it

#### Scenario: Preview matches the upload

- **WHEN** the example PDF is later uploaded to the saved source
- **THEN** the resulting transactions equal those shown in the preview

## MODIFIED Requirements

### Requirement: File and Amount Options

The dashboard SHALL let the user set the delimiter, skip a number of lines at
the start and end of the file, flip the sign of amounts, and choose an amount
layout via checkboxes: a single signed column (default), separate outflow and
inflow columns, or an amount column plus an in/out column (with the value that
marks money going out). With the single amount column the user SHALL also be
able to name a credit marker, a text such as "CR" that amounts carry at the end,
so that marked amounts are inflows and unmarked amounts are outflows. The
delimiter and skipped-line options apply to CSV sources only; the remaining
options apply to every source format.

#### Scenario: In/out layout

- **WHEN** the user chooses the in/out layout
- **THEN** the field selects offer "Amount" and "In/Out", and saving requires
  both plus the out value

#### Scenario: Skipped lines

- **WHEN** the user skips lines at the start of the file
- **THEN** those lines are excluded from the preview, and the header (if any) is
  taken from the first line after them

#### Scenario: Credit marker

- **WHEN** the user sets the credit marker "CR" and the amount column contains
  "59,00" and "113,83CR"
- **THEN** the preview shows the first as an outflow of 59.00 and the second as
  an inflow of 113.83

#### Scenario: No credit marker

- **WHEN** no credit marker is set
- **THEN** amounts are read exactly as before, from their printed sign

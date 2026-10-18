## ADDED Requirements

### Requirement: Transaction Shape Aligned With Actual Budget

The system SHALL define a `Transaction` type whose fields match the Actual
Budget API `Transaction` model (https://actualbudget.org/docs/api/reference), so
transactions produced from uploaded statements can be passed to Actual Budget's
`importTransactions`/`addTransactions` APIs without transformation. At minimum
the type SHALL support: `account`, `date` (`YYYY-MM-DD`), `amount` (integer, no
decimal places), `payee_name`, `imported_payee`, `category`, `notes`,
`imported_id`, `cleared`, and `id` (all optional except `account` and `date`,
consistent with the Actual Budget spec).

#### Scenario: Processing yields a well-formed transaction

- **WHEN** a statement row is processed using a source
- **THEN** the resulting object satisfies the `Transaction` type, including a
  `date` in `YYYY-MM-DD` format and an integer `amount` with no decimal places

#### Scenario: Transaction is ready for Actual Budget import

- **WHEN** processed transactions are passed to Actual Budget's
  `importTransactions` API
- **THEN** no field renaming or reshaping is required beyond selecting the
  target `accountId`

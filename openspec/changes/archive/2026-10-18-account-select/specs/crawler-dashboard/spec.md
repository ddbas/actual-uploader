## ADDED Requirements

### Requirement: Account Is Chosen From Actual Budget Accounts

The Upload tab SHALL present the account as a select listing the accounts
available in Actual Budget, showing each account's name and using its ID as the
value applied to the processed transactions.

#### Scenario: User picks an account by name

- **WHEN** the user opens the account select on the Upload tab
- **THEN** each available account is listed by name, and the chosen account's ID
  is used as the `account` of the processed transactions

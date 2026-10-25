## ADDED Requirements

### Requirement: Account Select Reflects Current Actual Accounts

Each time the Upload tab loads, the account select SHALL list the accounts that
currently exist in Actual Budget, including accounts created after the server
last contacted Actual.

#### Scenario: Account created in Actual after a previous visit

- **WHEN** the user creates an account in Actual Budget and then reloads the
  Upload tab
- **THEN** the new account appears in the account select

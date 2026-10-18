## ADDED Requirements

### Requirement: Accounts Endpoint

The server SHALL expose `GET /api/accounts` returning a list of `{ id, name }`
objects matching Actual Budget's `getAccounts()` result. Until the Actual Budget
connection is implemented, the list MAY be placeholder data.

#### Scenario: Accounts are listed

- **WHEN** a client requests `GET /api/accounts`
- **THEN** the response is a JSON array of objects each with an `id` and a
  `name`

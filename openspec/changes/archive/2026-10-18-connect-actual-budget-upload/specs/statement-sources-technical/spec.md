## MODIFIED Requirements

### Requirement: Accounts Endpoint

The server SHALL expose `GET /api/accounts` returning a list of `{ id, name }`
objects matching Actual Budget's `getAccounts()` result for the connected
budget. When the connection fails it SHALL respond 502 with an `error`.

#### Scenario: Accounts are listed

- **WHEN** a client requests `GET /api/accounts` while connected
- **THEN** the response is a JSON array of objects each with an `id` and a
  `name`

#### Scenario: Not connected

- **WHEN** a client requests `GET /api/accounts` and the connection fails
- **THEN** the response is 502 with an `error` message

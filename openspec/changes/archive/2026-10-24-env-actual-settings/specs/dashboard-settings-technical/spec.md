## ADDED Requirements

### Requirement: Locked Fields In Settings API

`GET /api/settings/actual` SHALL additionally return a `locked` object with a
boolean for each of `serverUrl`, `serverPassword`, `syncId` and
`encryptionPassword`, true when the field is provided by the environment. For
locked fields the returned values and password-set flags SHALL reflect the
environment value. `PUT /api/settings/actual` SHALL ignore locked fields in the
body, SHALL treat a locked required field as satisfied when validating, and
SHALL NOT persist environment-provided values.

#### Scenario: GET reports locked fields

- **WHEN** the server was started with `ACTUAL_SERVER_URL` set and a client
  requests `GET /api/settings/actual`
- **THEN** `locked.serverUrl` is true and the other fields are false

#### Scenario: PUT cannot change a locked field

- **WHEN** a client sends PUT with a different `serverUrl` while it is locked
- **THEN** the response is 200 and the environment value is still returned and
  used

#### Scenario: PUT omits locked required fields

- **WHEN** server URL and Sync ID are locked and a client sends PUT with only
  the server password
- **THEN** the response is 200 and the password is saved

#### Scenario: Environment values are not persisted

- **WHEN** settings are saved while some fields are environment-provided
- **THEN** `actual-settings.json` does not contain the environment values

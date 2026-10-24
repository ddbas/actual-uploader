## Purpose

Defines how the server emits logs: console-only structured output, an
environment-controlled level, consistent level semantics, and guarantees that
secrets and statement data never appear in logs.

## ADDED Requirements

### Requirement: Console-Only Log Output

The server SHALL write all logs to the process console (standard output) and
SHALL NOT write log files or use any file-based log destination.

#### Scenario: Logs go to the console

- **WHEN** the server starts and handles a request
- **THEN** log entries appear on standard output
- **AND** no log file is created in the data directory or elsewhere

### Requirement: Log Level Controlled by Environment

The server SHALL read the minimum log level from the `LOG_LEVEL` environment
variable, accepting `debug`, `info`, `warn`, and `error` (case-insensitive). An
unset or empty value SHALL mean `info`. Entries below the configured level SHALL
NOT be output.

#### Scenario: Default level

- **WHEN** `LOG_LEVEL` is unset
- **THEN** `info`, `warn`, and `error` entries are output
- **AND** `debug` entries are not

#### Scenario: Debug level

- **WHEN** `LOG_LEVEL=debug`
- **THEN** `debug`, `info`, `warn`, and `error` entries are output

#### Scenario: Error level

- **WHEN** `LOG_LEVEL=error`
- **THEN** only `error` entries are output

#### Scenario: Invalid level

- **WHEN** `LOG_LEVEL` is set to an unsupported value such as `verbose`
- **THEN** the server reports an invalid `LOG_LEVEL` configuration error
- **AND** exits with a non-zero status without starting

### Requirement: Level Semantics

The server SHALL use levels consistently: `debug` for diagnostic detail
(request/response details, Actual operation steps, timing); `info` for normal
lifecycle and significant operations (startup, listening address, completed
imports, source changes, settings updates); `warn` for recoverable or
unexpected-but-handled conditions (client errors such as invalid input, missing
settings, Actual connection failures reported to the user, unreadable settings
file falling back to defaults); `error` for unexpected failures (unhandled
exceptions, 5xx responses, startup failure).

#### Scenario: Client error is a warning

- **WHEN** a request is rejected with a 400 response
- **THEN** a `warn` entry is logged describing the rejection

#### Scenario: Unexpected failure is an error

- **WHEN** a request handler throws an unexpected exception and the server
  responds 500
- **THEN** an `error` entry is logged including the error's message and stack

### Requirement: Key Server Events Are Logged

The server SHALL log: startup and the listening address; effective log level;
each HTTP request's method, path, response status, and duration; source
create/delete and statement processing outcomes (counts only); each Actual
operation (status check, account listing, import) with outcome and duration;
settings loads and updates (which fields changed, never values of secrets); and
errors that are otherwise swallowed or only returned to the client.

#### Scenario: Request is logged

- **WHEN** a client calls any API endpoint
- **THEN** an entry records the method, path, status code, and duration

#### Scenario: Import outcome is logged

- **WHEN** an import to Actual completes
- **THEN** an `info` entry records the number of transactions added and updated

#### Scenario: Actual failure is logged

- **WHEN** a connection to Actual fails
- **THEN** a `warn` entry records the sanitized failure message

### Requirement: Secrets and Statement Data Are Never Logged

The server SHALL NOT include the Actual server password, the encryption
password, request bodies, statement contents, or transaction details in any log
entry at any level. Error messages logged SHALL be sanitized of stored secrets.

#### Scenario: Secret in error message

- **WHEN** an Actual error message contains the stored server password
- **THEN** the logged message shows `***` in its place

#### Scenario: Settings update

- **WHEN** Actual settings are updated with a new password
- **THEN** the log entry lists the changed field names only
- **AND** does not contain the password value

#### Scenario: Debug level still redacts

- **WHEN** `LOG_LEVEL=debug` and a statement is processed
- **THEN** no entry contains statement content or transaction fields

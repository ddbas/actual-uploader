## Purpose

Defines the technical contract that every account crawler must implement so new
crawlers can be added without changes to the dashboard or runner code: a common
`Crawler` interface, streaming transaction results, and a `Transaction` shape
aligned with Actual Budget's API.

## Requirements

### Requirement: Common Crawler Contract

The system SHALL define a common TypeScript interface that every account crawler
implements, so new crawlers can be added without changes to the dashboard or
runner code. The interface SHALL expose at minimum: a stable `id`, a
human-readable `name`, a human-readable `description`, and a `run` method.

#### Scenario: A crawler conforms to the interface

- **WHEN** a new crawler module is registered with the runner
- **THEN** the runner accepts it only if it implements `id`, `name`,
  `description`, and `run` as defined by the common `Crawler` interface

#### Scenario: Runner discovers crawler metadata without running it

- **WHEN** the dashboard requests the list of available crawlers
- **THEN** the runner returns each crawler's `id`, `name`, and `description`
  without invoking `run`

### Requirement: Streaming Transaction Results

Each crawler's `run` method SHALL return an asynchronous stream (e.g. an
`AsyncIterable`/`AsyncGenerator` of `Transaction` objects) rather than a
`Promise` that resolves with a complete array, so that collected transactions
can be surfaced to callers as soon as each one is produced.

#### Scenario: Transactions are consumed incrementally

- **WHEN** a crawler's `run` method yields transactions one at a time during
  execution
- **THEN** the runner is able to process and forward each transaction to
  consumers as soon as it is yielded, before the crawler finishes running

#### Scenario: Crawler completes successfully

- **WHEN** a crawler finishes producing all of its transactions
- **THEN** the async stream completes without emitting an error, and the runner
  marks that crawler run as finished

#### Scenario: Crawler run fails

- **WHEN** a crawler's `run` method throws or the returned stream raises an
  error during iteration
- **THEN** the runner marks that crawler run as failed and stops consuming
  further items from that crawler's stream, without affecting other crawlers'
  runs

### Requirement: Transaction Shape Aligned With Actual Budget

The system SHALL define a `Transaction` type whose fields match the Actual
Budget API `Transaction` model (https://actualbudget.org/docs/api/reference), so
transactions produced by crawlers can be passed to Actual Budget's
`importTransactions`/`addTransactions` APIs without transformation. At minimum
the type SHALL support: `account`, `date` (`YYYY-MM-DD`), `amount` (integer, no
decimal places), `payee_name`, `imported_payee`, `category`, `notes`,
`imported_id`, `cleared`, and `id` (all optional except `account` and `date`,
consistent with the Actual Budget spec).

#### Scenario: Crawler yields a well-formed transaction

- **WHEN** a crawler yields a transaction object
- **THEN** the object satisfies the `Transaction` type, including a `date` in
  `YYYY-MM-DD` format and an integer `amount` with no decimal places

#### Scenario: Transaction is ready for Actual Budget import

- **WHEN** a completed crawler run's transactions are passed to Actual Budget's
  `importTransactions` API
- **THEN** no field renaming or reshaping is required beyond selecting the
  target `accountId`

## ADDED Requirements

### Requirement: Mock Crawler Implements the Common Crawler Interface

The `mock` crawler SHALL be implemented as a conformant implementation of the
common `Crawler` interface (see `crawler-interface-technical`), serving as the
project's reference implementation for future crawlers. Its `name` field SHALL
be set to "Desjardins (Mock)".

#### Scenario: Mock crawler conforms to the Crawler interface

- **WHEN** the `mock` crawler module is registered with the runner
- **THEN** it is accepted because it implements `id`, `name`, `description`, and
  `run` as defined by the `Crawler` interface

### Requirement: Mock Crawler Uses Playwright for Browser Automation

The mock crawler's `run` method SHALL use Playwright to launch a Chromium
browser instance, navigate it to
`https://accweb.mouv.desjardins.com/identifiantunique/securite-garantie/authentification/auth/manuel`,
wait 5 seconds, and then close the Playwright browser instance, without
attempting to authenticate.

#### Scenario: Mock crawler opens the target page via Playwright

- **WHEN** the mock crawler's `run` method is invoked
- **THEN** a Playwright Chromium browser instance is launched, a page is
  navigated to the Desjardins authentication URL, the crawler waits 5 seconds,
  and the Playwright browser instance is closed before the run yields any
  transactions

### Requirement: Mock Crawler Yields Hard-Coded Transaction Objects

The mock crawler's `run` generator SHALL yield a small, fixed set of hard-coded
`Transaction` objects conforming to the common `Transaction` type after its
Playwright browser instance closes, and SHALL then complete.

#### Scenario: Mock crawler yields hard-coded transactions

- **WHEN** the mock crawler's Playwright browser instance has been closed
- **THEN** the crawler's `run` generator yields one or more hard-coded
  `Transaction` objects, each with at least `account`, `date`, and `amount` set,
  and the generator then completes

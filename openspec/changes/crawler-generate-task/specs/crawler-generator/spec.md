## Purpose

Defines the developer-facing behavior of the `crawler:generate` task, which
records a browsing session against a bank website and scaffolds a new crawler
from it while keeping credential entry manual.

## ADDED Requirements

### Requirement: Generate Task Accepts a Name and a Start URL

The system SHALL provide a `crawler:generate` task that takes two positional
arguments: the crawler name and the URL on which recording starts. The task
SHALL fail with a usage message, without opening a browser, if either argument
is missing, if the URL is not a valid http(s) URL, or if the name is not a valid
kebab-case identifier.

#### Scenario: Valid arguments start a recording

- **WHEN** the developer runs
  `crawler:generate my-bank https://bank.example/login`
- **THEN** a browser opens on `https://bank.example/login` with recording
  enabled

#### Scenario: Missing argument

- **WHEN** the developer runs `crawler:generate my-bank` with no URL
- **THEN** the task exits with a non-zero status and prints usage, and no
  browser opens

#### Scenario: Name matches an existing crawler

- **WHEN** a crawler with the given name already exists and the developer
  finishes a recording
- **THEN** the existing crawler file is overwritten by the newly generated one
  and its registration is not duplicated

#### Scenario: Existing crawler preserved if recording is empty

- **WHEN** a crawler with the given name already exists and the developer closes
  the session without recording any steps
- **THEN** the existing crawler is left untouched

### Requirement: Scaffold Is Produced When Recording Ends

When the developer finishes recording by closing the recording session, the
system SHALL create a new crawler from the recorded steps and register it so it
appears in the dashboard. The crawler SHALL implement the standard crawler
interface. The portion that extracts transactions SHALL be left as a clearly
marked placeholder for the developer to complete.

#### Scenario: Recording finished

- **WHEN** the developer closes the recording session after performing steps
- **THEN** a crawler file containing those steps exists, is registered, and the
  task reports its path

#### Scenario: Nothing recorded

- **WHEN** the developer closes the recording session without performing any
  steps
- **THEN** no crawler is created and the task reports that nothing was recorded

### Requirement: Manual Steps Can Be Marked During Recording

The developer SHALL be able to mark a step as manual while recording by typing
the documented sentinel value `__PAUSE__` into the field in question. In the
generated crawler, each marked step SHALL pause for the user to act manually
instead of replaying a recorded action.

#### Scenario: Login marked as manual

- **WHEN** the developer types `__PAUSE__` into the username and password fields
  and submits
- **THEN** the generated crawler pauses at that point and does not contain the
  sentinel or any typed value

### Requirement: Credentials Are Never Written to Disk

The generated crawler SHALL NOT contain credential values. Text entered into
fields that appear to be password fields SHALL be removed and replaced with a
manual pause even if the developer did not mark them, and the task SHALL tell
the developer when it did so.

#### Scenario: Unmarked password entry

- **WHEN** the developer types a real password into a password field during
  recording
- **THEN** the generated crawler contains a manual pause in its place, the
  password appears nowhere in the generated files, and the task prints a warning

### Requirement: Task Instructs the Developer

Before opening the browser the task SHALL print brief instructions covering how
to mark a manual step and how to finish recording.

#### Scenario: Instructions shown

- **WHEN** recording starts
- **THEN** the terminal shows the sentinel value and how to end the recording

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

The developer SHALL be able to mark a manual section while recording by focusing
an element (clicking a field or button) and pressing a documented marker key
(default `Escape`, configurable) once to start the section, then focusing an
element and pressing it again to end it. A press with no element focused is not
recorded by Playwright codegen and so cannot be recognized. In the generated
crawler, each marked section SHALL be replaced by a single pause for the user to
act manually, and nothing recorded inside the section SHALL be replayed or
stored.

#### Scenario: Login marked as manual

- **WHEN** the developer presses the marker key, logs in by typing credentials
  and submitting, then presses the marker key again
- **THEN** the generated crawler pauses at that point, and contains neither the
  steps performed inside the section nor any typed value

#### Scenario: Marker pressed with a non-input element focused

- **WHEN** the developer clicks a button or link and presses the marker key
- **THEN** it is recognized as a section boundary

#### Scenario: Marker pressed with nothing focused

- **WHEN** the developer presses the marker key while no element is focused
- **THEN** codegen does not record it, and the resulting unmatched marker is
  handled as an unterminated section with a warning that tells the developer to
  focus an element first

#### Scenario: Unterminated manual section

- **WHEN** the recording ends after a start marker with no matching end marker
- **THEN** everything after the start marker is treated as manual and the task
  prints a warning that suggests focusing an element before pressing the marker
  key

#### Scenario: Odd number of markers

- **WHEN** the recording contains an odd number of marker presses, for example
  because the start press was dropped for lack of focus
- **THEN** the task prints a warning stating the count, explaining that a press
  was probably not recorded and why, and telling the developer to review the
  generated crawler

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

### Requirement: Task Displays a Prominent Pause-Key Reminder

Before opening the browser the task SHALL print a large, visually distinct
banner, impossible to mistake for ordinary log output, stating that the marker
key (default `Escape`) toggles manual (pause) mode on and off, that anything
done between the two presses (such as logging in) is not recorded, and that an
element must be clicked/focused before pressing the key. The banner SHALL
reflect the configured marker key and SHALL also say how to finish recording. On
macOS, when the marker key is a function key, it SHALL note that the `fn` key
may need to be held.

#### Scenario: Banner shown at start

- **WHEN** recording starts
- **THEN** the terminal shows the banner naming the marker key as the
  manual-mode toggle, before the browser opens

#### Scenario: Custom marker key

- **WHEN** the developer configures a different marker key
- **THEN** the banner names that key instead of `Escape`

### Requirement: Generated Crawler Appears in the Dashboard

A crawler produced by the task SHALL appear in the dashboard's list of available
crawlers, and SHALL be runnable from it, without the developer editing any
additional files. The crawler's display name SHALL be derived from the given
name.

#### Scenario: New crawler listed

- **WHEN** a crawler is generated and the application is rebuilt and started
- **THEN** the dashboard's crawler list includes the new crawler and it can be
  run from the Home tab

#### Scenario: Regenerated crawler is not listed twice

- **WHEN** a crawler is regenerated under an existing name
- **THEN** the dashboard lists it exactly once

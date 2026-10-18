## Purpose

Defines the technical requirements for the `crawler:generate` task: how recorded
code is captured and transformed, and how the task is wired into the repository
tooling.

## ADDED Requirements

### Requirement: Task Is Exposed Through Mise

The task SHALL be defined in `mise.toml` as `crawler:generate` and accept the
crawler name and start URL as arguments. It SHALL be runnable with
`mise run crawler:generate <name> <url>`.

#### Scenario: Task is listed

- **WHEN** a developer runs `mise tasks`
- **THEN** `crawler:generate` appears with a description

### Requirement: Recording Uses Playwright's Recorder With File Output

The task SHALL launch the browser itself and enable Playwright's recorder on its
context with JavaScript output written to a temporary file, and SHALL read that
file after the browser closes and remove it afterward. It SHALL inject a
floating manual-mode toggle button (identified by the token
`crawler-manual-toggle`) into top-level pages, whose recorded clicks serve as
manual-section markers. The button's on/off state SHALL persist across page
navigations.

#### Scenario: Generated code is read after exit

- **WHEN** the browser closes after the user finishes the session
- **THEN** the task reads the temporary output file and removes it afterward

#### Scenario: Toggle clicks are recorded

- **WHEN** the user clicks the injected toggle button
- **THEN** the recording contains a statement naming `crawler-manual-toggle`

### Requirement: Browser Reduces Automation Signals

Both the recording browser and generated crawlers SHALL use a shared launcher
that prefers the installed Google Chrome, omits the `--enable-automation`
switch, and disables the `AutomationControlled` blink feature, falling back to
Playwright's Chromium with a warning if Chrome is unavailable.

#### Scenario: Chrome unavailable

- **WHEN** Google Chrome is not installed
- **THEN** the launcher falls back to Chromium and prints a warning

### Requirement: Recorded Code Is Post-Processed Before Being Written

After reading the recording, the task SHALL transform it as follows before
writing any crawler file: (1) every span of statements delimited by a pair of
statements naming the toggle button token is replaced with a single
`await page.pause();`, and an unmatched start marker extends the span to the end
of the recording; (2) every `fill` statement targeting a likely password field
(by accessible name or selector matching a configurable pattern list including
English and French terms) is replaced with `await page.pause();`; (3) the
Playwright test wrapper and launch boilerplate are removed so only the page
steps remain. Redaction SHALL occur in memory before any crawler file is
written; the raw recording SHALL be deleted.

#### Scenario: Marked span replaced

- **WHEN** the recording contains a toggle click, a username `fill`, a password
  `fill`, a submit `click`, and a second toggle click
- **THEN** the output contains a single `await page.pause();` in their place

#### Scenario: Password-like fill replaced

- **WHEN** the recording contains a `fill` on a field named "Mot de passe" with
  a real value
- **THEN** the output contains `await page.pause();` in its place and the value
  is not written anywhere

### Requirement: Generated Crawler Conforms to the Crawler Interface

The generated module SHALL export a `Crawler` from `crawler-core` with a
kebab-case `id` equal to the given name, launch a headed (non-headless) browser
through the shared launcher so manual pauses are usable, and be registered in
`packages/crawlers/src/index.ts`. It SHALL compile under the repo's TypeScript
settings and pass Biome checks.

#### Scenario: Generated crawler builds

- **WHEN** a crawler is generated and `mise run pnpm:build` is run
- **THEN** the build succeeds and the crawler is returned by the registry

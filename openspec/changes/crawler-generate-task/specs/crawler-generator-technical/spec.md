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

### Requirement: Recording Uses Only Public Playwright APIs

The task SHALL record using only public Playwright APIs: it SHALL launch the
browser itself, inject a recorder script with `addInitScript`, and receive
events with `exposeFunction`. It SHALL NOT use private or underscore-prefixed
Playwright APIs. The recorder SHALL generate `click`, `check`/`uncheck`, `fill`,
`selectOption` and Enter `press` steps from trusted user events, and SHALL show
a floating manual-mode toggle button in top-level pages whose state persists
across navigations. While manual mode is on, no events SHALL be recorded and no
typed values SHALL leave the page; `type=password` inputs SHALL never have their
value captured. No raw recording SHALL be written to disk.

#### Scenario: Manual input never captured

- **WHEN** the user toggles manual mode on and types a username and password
- **THEN** none of the typed values appear in the recorder's output

#### Scenario: Unmarked password input

- **WHEN** the user types into a `type=password` input outside manual mode
- **THEN** the recorder emits a pause for it and no value is captured

### Requirement: Browser Reduces Automation Signals

Both the recording browser and generated crawlers SHALL use a shared launcher
that prefers the installed Google Chrome, omits the `--enable-automation`
switch, and disables the `AutomationControlled` blink feature, falling back to
Playwright's Chromium with a warning if Chrome is unavailable.

#### Scenario: Chrome unavailable

- **WHEN** Google Chrome is not installed
- **THEN** the launcher falls back to Chromium and prints a warning

### Requirement: Recorded Steps Are Sanitized Before Being Written

Before writing any crawler file, the task SHALL replace every `fill` statement
targeting a likely password field (by locator text matching a configurable
pattern list including English and French terms) with `await page.pause();` and
warn the developer. Consecutive pauses SHALL be collapsed.

#### Scenario: Password-like fill replaced

- **WHEN** the recorded steps contain a `fill` on a field named "Mot de passe"
  with a real value
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

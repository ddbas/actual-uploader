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

### Requirement: Recording Uses Playwright Codegen With File Output

The task SHALL record using Playwright's codegen (`playwright codegen`)
targeting JavaScript/TypeScript output, written to a temporary file via its
`--output` option, and SHALL read that file after the codegen process exits. It
SHALL NOT rely on private Playwright APIs or on scraping the Inspector UI.

#### Scenario: Generated code is read after exit

- **WHEN** the codegen process exits after the user closes the session
- **THEN** the task reads the temporary output file and removes it afterward

### Requirement: Recorded Code Is Post-Processed Before Being Written

After reading the recording, the task SHALL transform it as follows before
writing any crawler file: (1) every span of statements delimited by a pair of
`press` statements for the marker key is replaced with a single
`await page.pause();`, and an unmatched start marker extends the span to the end
of the recording; (2) every `fill` statement targeting a likely password field
(by accessible name or selector matching a configurable pattern list including
English and French terms) is replaced with `await page.pause();`; (3) the
Playwright test wrapper and launch boilerplate are removed so only the page
steps remain. Redaction SHALL occur in memory before any crawler file is
written; the raw recording SHALL be deleted.

#### Scenario: Marked span replaced

- **WHEN** the recording contains a `press('F9')`, a username `fill`, a password
  `fill`, a submit `click`, and a second `press('F9')`
- **THEN** the output contains a single `await page.pause();` in their place

#### Scenario: Password-like fill replaced

- **WHEN** the recording contains a `fill` on a field named "Mot de passe" with
  a real value
- **THEN** the output contains `await page.pause();` in its place and the value
  is not written anywhere

### Requirement: Generated Crawler Conforms to the Crawler Interface

The generated module SHALL export a `Crawler` from `crawler-core` with a
kebab-case `id` equal to the given name, launch a headed (non-headless) browser
so manual pauses are usable, and be registered in
`packages/crawlers/src/index.ts`. It SHALL compile under the repo's TypeScript
settings and pass Biome checks.

#### Scenario: Generated crawler builds

- **WHEN** a crawler is generated and `mise run pnpm:build` is run
- **THEN** the build succeeds and the crawler is returned by the registry

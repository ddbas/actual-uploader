## Context

Crawlers live in `packages/crawlers/src` and implement `Crawler` from
`crawler-core` (see `mock.ts`). `playwright` is already a dependency of
`packages/crawlers`. Nothing in the repo currently helps authoring a crawler.
All tasks run through Mise.

Research findings that shape this design:

1. **Getting the generated code programmatically: yes.** `playwright codegen`
   supports `-o, --output <file>` ("saves the generated script to a file") and
   `--target <lang>`. The recorder rewrites that file as actions occur. The task
   spawns the CLI, waits for the process to exit (closing the browser /
   Inspector), and reads the file. The Playwright library has no public API that
   returns recorded code; the recorder is only reachable via the CLI or private
   `_enableRecorder`-style internals, which we avoid.
2. **Marking a `page.pause()` step in codegen: no built-in way.** The recorder
   UI offers record/stop, copy, clear, target language, and assertion tools, but
   no "insert pause" action. (`page.pause()` is the opposite direction: it opens
   the Inspector from inside a script.) So the marker must be conveyed through
   something the recorder does capture: typed text.

## Goals / Non-Goals

**Goals:**

- One command from "I want a crawler for X" to a registered, buildable crawler
  skeleton.
- Credentials are never persisted, whether marked or not.

**Non-Goals:**

- Auto-generating transaction extraction. The developer writes that.
- Full automated login; credentials are always entered by a human.
- Supporting languages other than TypeScript output.
- Handling MFA beyond what a manual pause already allows.

## Decisions

**Sentinel text marks manual steps.** The developer types `__PAUSE__` into a
field; post-processing replaces that statement with `await page.pause();`.
Alternatives: (a) a pause key/button — not supported by codegen; (b) a two-pass
flow where the developer later edits the file by hand — easy to forget and risks
committing credentials; (c) only heuristic redaction — catches passwords but not
usernames, one-time codes, or other manual steps. The sentinel handles arbitrary
steps; heuristics are the safety net.

**Heuristic redaction as a safety net.** `fill` statements whose target matches
a pattern list (`password`, `passcode`, `mot de passe`, `pin`, `nip`, ...)
become pauses even without the sentinel, with a warning. Keeps real passwords
out of memory-to-disk paths. Usernames are not auto-redacted (too many false
positives); users mark them with the sentinel.

**Spawn the codegen CLI rather than a library API.** Use the local `playwright`
binary (`pnpm exec playwright codegen --target=javascript -o <tmp> <url>`),
avoiding `npx` downloads and private APIs. Alternative `playwright-test` target
rejected since output wraps in a test; library JS output is easier to strip down
to page steps.

**Script is TypeScript in `packages/crawlers/scripts/`,** alongside the existing
`smoke-mock.ts`, invoked by the Mise task. Pure transformation
(`sanitize(recording) → steps`) is a separate function for unit testing.

**Existing names are overwritten.** Regenerating a crawler replaces its file (it
is the intended way to re-record a broken flow). The write happens only after a
non-empty recording is sanitized, so a cancelled session never destroys an
existing crawler.

**Templated output.** A template emits a crawler file with `id`, `name`,
`description`, a headed `chromium.launch({ headless: false })`, the processed
steps, and a `// TODO: extract transactions` placeholder yielding nothing. Index
registration is done by inserting an import and `registerCrawler` line.

## Risks / Trade-offs

- [Recorder output format changes between Playwright versions] → Transform
  matches on statement patterns narrowly, is covered by unit tests with fixture
  recordings, and the task fails loudly if the output has no recognizable page
  steps.
- [Heuristic redaction misses a credential field with an unusual name] →
  Document the sentinel as the primary mechanism; warn the user to review the
  generated file; keep the raw recording only in a temp file that is deleted.
- [Sentinel typed into a real field may trigger validation errors during
  recording] → Acceptable; the field is just text and the step is discarded
  afterward.
- [`page.pause()` requires a headed browser] → Generated crawlers launch headed.
  If crawlers later run from the server/dashboard, a headed browser must be
  available (relevant to the broader "real crawler" TODO).

## Open Questions

- Whether closing only the browser window (vs. the Inspector) reliably ends the
  codegen process on all platforms; to be verified during implementation.

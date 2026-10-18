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
   something the recorder does capture.
3. **What the recorder captures from the keyboard.** Checked against the
   recorder source (`packages/injected/src/recorder/recorder.ts`): printable
   characters typed with no modifier are _not_ recorded as key presses; they
   only appear as a `fill` when an editable field is focused (and a `check` on a
   checkbox). Typing a word outside a field is therefore invisible.
   Non-printable keys (e.g. `F9`, arrows, `Escape`) and any key with
   Ctrl/Alt/Meta _are_ recorded as `press` actions, even with nothing focused
   (they target the focused element or `body`). So a function key or a modifier
   chord works as a marker, anywhere on the page.

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

**A marker key delimits manual sections.** The developer presses `F9` (default;
configurable with an option) to begin a manual section, does the manual work
(typing credentials, solving MFA, ...) in the recording browser, then presses
`F9` again. Post-processing drops every recorded statement between the two
`press('F9')` statements and emits one `await page.pause();`. This beats marking
individual fields: the recorded submit click or navigation inside the section
would otherwise replay after the human already did it, and typed values never
reach the output. An unmatched start marker treats the rest of the recording as
manual, with a warning. Marker key choice: a bare function key avoids colliding
with typing, works with no field focused, and is recorded by codegen. Avoid
`F5`/`F11`/`F12`/`Escape` (browser or page behavior). Mac laptops need `fn` for
F-keys, which is why the key is configurable. Alternatives: (a) sentinel text
such as `__PAUSE__` typed into a field — only works in an editable field and
leaves a bogus `fill` to clean up; (b) a Playwright UI button — none exists; (c)
hand-editing afterwards — easy to forget and risks committing credentials; (d)
only heuristic redaction — catches passwords but not usernames, one-time codes,
or other manual steps.

**Heuristic redaction as a safety net.** `fill` statements whose target matches
a pattern list (`password`, `passcode`, `mot de passe`, `pin`, `nip`, ...)
become pauses even without the marker key, with a warning. Keeps real passwords
out of memory-to-disk paths. Usernames are not auto-redacted (too many false
positives); users mark them with the marker key.

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
  Document the marker key as the primary mechanism; warn the user to review the
  generated file; keep the raw recording only in a temp file that is deleted.
- [The marker key press reaches the page and may trigger a site shortcut, or the
  browser may swallow it] → Default to `F9`, make it configurable, and verify in
  the spike that codegen records it.
- [`page.pause()` requires a headed browser] → Generated crawlers launch headed.
  If crawlers later run from the server/dashboard, a headed browser must be
  available (relevant to the broader "real crawler" TODO).

## Open Questions

- Whether closing only the browser window (vs. the Inspector) reliably ends the
  codegen process on all platforms; to be verified during implementation.

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
   offers no "insert pause" action.
3. **Keyboard markers proved unreliable.** In theory the recorder captures
   non-printable keys such as `F9`, but in practice the press was not picked up
   for the developer (browser/OS function-key handling, e.g. macOS media keys,
   and page key handling). The marker therefore uses a mouse click on an
   injected UI element, which the recorder records reliably (verified).
4. **Bank sites deny automated browsers.** Playwright's default launch passes
   `--enable-automation`, sets `navigator.webdriver`, and `playwright codegen`
   offers no way to remove these; the developer saw "access denied" after login.
   Mitigations (not a guarantee): launch the user's installed Google Chrome
   (`channel: "chrome"`), drop `--enable-automation`, and pass
   `--disable-blink-features=AutomationControlled`. The same options are used by
   generated crawlers via a shared `launchBrowser()` helper.

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

**A floating toggle button delimits manual sections.** The task launches the
browser itself and injects, into every top-level page, a button (in an open
shadow root, fixed bottom-right, `aria-label`/id `crawler-manual-toggle`) that
shows red "MANUAL MODE ON" or green "Recording". The developer clicks it to
begin a manual section, does the manual work (typing credentials, solving MFA,
...), then clicks it again. The recorder records each click as a statement
naming `crawler-manual-toggle`; post-processing drops every statement between
two such statements and emits one `await page.pause();`. This beats marking
individual fields: the recorded submit click or navigation inside the section
would otherwise replay after the human already did it, and typed values never
reach the output. An unmatched start marker treats the rest of the recording as
manual, with a warning. Button state is held by the task process and pushed to
pages so it survives navigations. Alternatives rejected: a function-key marker
(not reliably recorded, see finding 3), sentinel text typed into a field (only
works in editable fields), hand-editing afterwards (easy to forget), and only
heuristic redaction (misses usernames and one-time codes).

**Heuristic redaction as a safety net.** `fill` statements whose target matches
a pattern list (`password`, `passcode`, `mot de passe`, `pin`, `nip`, ...)
become pauses even without the toggle, with a warning. Keeps real passwords out
of memory-to-disk paths. Usernames are not auto-redacted (too many false
positives); users mark them with the toggle button.

**Launch the browser ourselves and enable the recorder on its context.** The
task launches the browser via `launchBrowser()` and calls
`BrowserContext._enableRecorder({ mode: "recording", outputFile, ... })`, the
same private call `playwright codegen` makes. This is the only way to both
control launch options and inject the toggle button (the CLI offers neither).
Trade-off: it relies on a private API; the `playwright` version is pinned in the
lockfile, `sanitize()` fails loudly on unrecognizable output, and unit tests
cover the format. The recording is written to a temp file, read after the
browser disconnects, and deleted. Injected scripts are plain strings (bundlers
inject helpers like `__name` into serialized functions, which break in-page).

**Script is TypeScript in `packages/crawlers/scripts/`,** alongside the existing
`smoke-mock.ts`, invoked by the Mise task. Pure transformation
(`sanitize(recording) → steps`) is a separate function for unit testing.

**Existing names are overwritten.** Regenerating a crawler replaces its file (it
is the intended way to re-record a broken flow). The write happens only after a
non-empty recording is sanitized, so a cancelled session never destroys an
existing crawler.

**Templated output.** A template emits a crawler file with `id`, `name`,
`description`, a headed browser from `launchBrowser()`, the processed steps, and
a `// TODO: extract transactions` placeholder yielding nothing. Index
registration is done by inserting an import and `registerCrawler` line.

## Risks / Trade-offs

- [Recorder output format changes between Playwright versions] → Transform
  matches on statement patterns narrowly, is covered by unit tests with fixture
  recordings, and the task fails loudly if the output has no recognizable page
  steps.
- [Heuristic redaction misses a credential field with an unusual name] →
  Document the marker key as the primary mechanism; warn the user to review the
  generated file; keep the raw recording only in a temp file that is deleted.
- [The injected button could be hidden or blocked by a page's own overlay or
  CSP] → It uses the maximum z-index in a shadow root and is added through the
  init-script mechanism, which is not subject to page CSP.
- [Anti-bot detection may still trigger (CDP, fingerprinting)] → Best effort; if
  a site still denies access, fall back to a persistent real-Chrome profile or
  attaching to a manually started Chrome (future work).
- [`page.pause()` requires a headed browser] → Generated crawlers launch headed.
  If crawlers later run from the server/dashboard, a headed browser must be
  available (relevant to the broader "real crawler" TODO).

## Open Questions

- Whether the mitigations are enough for the developer's bank; to be verified by
  the developer.

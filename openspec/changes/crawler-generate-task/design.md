## Context

Crawlers live in `packages/crawlers/src` and implement `Crawler` from
`crawler-core` (see `mock.ts`). `playwright` is already a dependency of
`packages/crawlers`. Nothing in the repo currently helps authoring a crawler.
All tasks run through Mise.

Research findings that shape this design:

1. **Playwright has no public API that returns recorded code.** The
   `playwright codegen` CLI is public but cannot be customized (no launch
   options, no UI injection, no way to mark a manual step), and the recorder
   inside the library is only reachable through private internals
   (`_enableRecorder`), which we do not use. The task therefore ships its own
   small recorder built only from public APIs: `chromium.launch`,
   `context.addInitScript`, `context.exposeFunction`, and ordinary page events.
2. **Marking a `page.pause()` step in codegen: no built-in way**, and a keyboard
   marker (`F9`) was not picked up for the developer (browser/OS function-key
   handling). The marker is therefore a click on an injected UI element, which
   our own recorder controls.
3. **Bank sites deny automated browsers.** Playwright's default launch passes
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
...), then clicks it again. The toggle emits one `await page.pause();` when
switched on and the recorder ignores events until it is switched off. This beats
marking individual fields: the recorded submit click or navigation inside the
section would otherwise replay after the human already did it, and typed values
never reach the output. An unmatched start marker treats the rest of the
recording as manual, with a warning. Button state is held by the task process
and pushed to pages so it survives navigations. Alternatives rejected: a
function-key marker (not reliably recorded, see finding 3), sentinel text typed
into a field (only works in editable fields), hand-editing afterwards (easy to
forget), and only heuristic redaction (misses usernames and one-time codes).

**Heuristic redaction as a safety net.** `fill` statements whose target matches
a pattern list (`password`, `passcode`, `mot de passe`, `pin`, `nip`, ...)
become pauses even without the toggle, with a warning. Keeps real passwords out
of memory-to-disk paths. Usernames are not auto-redacted (too many false
positives); users mark them with the toggle button.

**Own recorder built on public APIs.** The task launches the browser via
`launchBrowser()`, injects `scripts/recorder-page.js` with `addInitScript`, and
receives events through `exposeFunction`. The page script listens (capture
phase) for trusted `click`, `change` and Enter `keydown` events and emits
`click`/`check`/`uncheck`/`fill`/`selectOption`/`press("Enter")` actions with a
generated locator (test id, label, placeholder, role+name, text, id, then a CSS
path; `.nth(i)` when ambiguous). Only the top frame is recorded (iframes and
popups are not; a limitation). Statements are generated in Node. Because the
page script and the Node side both drop events while manual mode is on, typed
values from manual sections never leave the page; `type=password` inputs are
reported without their value and become a pause; no raw recording is written to
disk. The toggle click is not recorded; the toggle itself emits the pause.
Trade-off: locators are less refined than codegen's, so the developer should
review the generated file. Injected scripts are shipped as a plain `.js` file
(bundlers inject helpers like `__name` into serialized functions, which break
in-page).

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

- [Our recorder produces coarser locators than codegen and misses iframes and
  popups] → Unit/integration tests against a real browser; the generated file is
  meant to be reviewed; manual sections cover the common iframe logins.
- [Heuristic redaction misses a credential field with an unusual name] →
  `type=password` inputs are never captured; manual mode is the primary
  mechanism; warn the user to review the generated file; no raw recording is
  persisted.
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

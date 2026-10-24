## Context

`SettingsTab.tsx` is a `flex gap-6` row with a `w-40` menu; at 375px content
gets ~143px. See proposal.md - Why. The project already uses Tailwind and
daisyUI.

## Goals / Non-Goals

**Goals:** usable Settings, Upload on phones with minimal markup change.

**Non-Goals:** touch-friendly PDF column editor; Playwright/visual tests.

## Decisions

- **Select on narrow, menu on wide** (chosen over stacked menu, horizontal menu,
  drill-down). Scales to many pages and gives content the full width. Render
  both from the `pages` array: `<select class="select md:hidden">` and the
  existing `<ul class="menu hidden md:flex">`.
- **Hide with CSS `hidden`/`md:hidden`, not conditional JS render.** Avoids a
  viewport-measuring hook. `display:none` also removes the hidden one from the
  accessibility tree.
- **Container: `flex-col md:flex-row`**, `px-4 md:px-6` on `App`.
- **Tables:** wrap in `overflow-x-auto`.

## Risks / Trade-offs

- Two renderings of one nav → both derive from `pages`; test asserts both list
  the same entries. jsdom ignores CSS, so tests see both elements. Tests should
  scope queries by role (`combobox` vs `navigation`).
- Layout is verified manually (no browser tests) → regressions can slip in.

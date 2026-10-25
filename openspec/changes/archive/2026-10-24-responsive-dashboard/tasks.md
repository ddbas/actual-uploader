## 1. Settings navigation

- [x] 1.1 Render a select of settings pages (narrow) alongside the side menu
  (wide) from the `pages` list in `SettingsTab.tsx`; verify both switch pages in
  updated `SettingsTab.test.tsx`
- [x] 1.2 Make the container `flex-col md:flex-row` so content takes full width
  on narrow viewports; verify manually at 375px and 1024px

## 2. Page fit

- [x] 2.1 Use `px-4 md:px-6` on the `App` container; verify manually at 375px
- [x] 2.2 Wrap tables in `UploadTab`, `MappingStep`, `PdfSourceSetup` in
  `overflow-x-auto`; verify no page-level horizontal scroll at 375px and
  existing tests pass

## 3. Wrap-up

- [x] 3.1 Run `mise` lint/test tasks and confirm they pass

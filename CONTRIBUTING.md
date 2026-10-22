# Contributing

This project uses [mise](https://mise.jdx.dev) for managing dev tools,
environment variables, and tasks.

## Tasks

List the available tasks.

```sh
mise tasks
```

Run a task.

```sh
mise run <task>
```

## Tools

List the available dev tools.

```sh
mise list
```

Run a dev tool.

```sh
mise exec -- <devtool>
```

## Adding a PDF extraction approach

PDF sources are extracted by pluggable _approaches_.

1. In `packages/statement-core/src/pdf/`, implement the `Approach` contract
   (`id`, `label`, `initialConfig`, `validateConfig` and a pure `run` from text
   items to transactions, errors and warnings). Keep its configuration
   versioned. Test it with the synthetic fixture in `pdf/fixture.ts` (never
   commit a real statement).
2. Register it in `APPROACHES` in `pdf/registry.ts`.
3. In `apps/dashboard/src/editors.ts`, add its setup editor. The `EDITORS`
   record is typed over the registered identifiers, so forgetting this fails
   type-checking.

Storage, the process endpoint and the wizard shell need no changes. Only
`packages/statement-pdf` may depend on the PDF parser.

## Context

`ActualSettingsStore` holds the settings, persists them to
`DATA_DIR/actual-settings.json`, and serves two views: `get()` (no secrets) and
`getSecret()` (for `ActualClient`, which calls it on every operation). Network
env vars (`PORT`, `HOST`, `DATA_DIR`) are parsed in `config.ts`, which throws
`ConfigError` on bad input; `bin.ts` turns that into exit code 1. See
proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Env values apply live through the existing `getSecret()` path with no
  `ActualClient` changes.
- Env secrets never touch disk.

**Non-Goals:**

- `*_FILE` secret variants (decided: plain env vars only).
- Hot-reloading env vars; they are read once at startup.
- Changing the saved-settings file format.

## Decisions

**Env overlay inside the store, per field.** `config.ts` gains
`resolveActualEnv(env)` returning `Partial<ActualSettings>` (empty string →
omitted, malformed URL → `ConfigError`). `ActualSettingsStore` takes it as a
constructor option. `getSecret()` returns `{...saved, ...envOverrides}`; `get()`
adds `locked` flags. Alternative: seed the store from env and save to the file —
rejected: secrets would be copied to disk and rotating env values would silently
stop working after the first UI save.

**Saved values are kept separately and untouched.** `update()` merges only
unlocked fields into the saved settings and writes only those, so removing an
env var reveals the previously saved value again.

**Validation runs against the merged result.** A locked required field counts as
satisfied; locked fields in the PUT body are ignored rather than rejected, so
the dashboard needn't special-case what it sends and stale clients don't break.
Alternative: 4xx on locked fields — stricter, but adds an error path for no user
benefit.

**Startup validation only for provided vars.** Only `ACTUAL_SERVER_URL` has
checkable syntax (http/https). Reusing `validateActualSettings`' URL rule keeps
one definition. A partial environment is valid.

**Dashboard.** `ActualSettingsView` gains `locked`. `ActualSettingsPage`
disables locked inputs, shows a "Set by environment" badge, shows the password
placeholder for locked secrets, omits locked fields from the PUT payload, and
skips client-side required checks for locked fields. When every field is locked
the Save button is disabled.

**No Dockerfile `ENV`.** Defaults for per-deployment values and secrets don't
belong in the image; the README documents the variables.

## Risks / Trade-offs

- [Plain env vars are visible via `docker inspect` and `/proc`] → document it in
  the README and recommend `env_file` / orchestrator secret injection; add
  `_FILE` support later if needed.
- [Saved values hidden behind env values can confuse] → locked fields show the
  badge; removing the var restores the saved value.
- [A typo'd env var name silently does nothing] → documented names only; the UI
  shows unlocked fields, making it visible.

## Context

`bin.ts` previously parsed `--data-dir` and read `ACCOUNT_CRAWLER_DATA_DIR`,
`PORT`, and hardcoded `127.0.0.1`. The monorepo uses Turborepo, so the image is
built from the repo root using `turbo prune server --docker`.

## Goals / Non-Goals

**Goals:** environment-only configuration (`DATA_DIR`, `PORT`, `HOST`); a
working container image listening on port 80 with data in `/data`.

**Non-Goals:** a permanent storage solution; proper TLS CA trust.

## Decisions

- **Plain env vars, no CLI parsing.** Simpler and the idiomatic way to configure
  containers. The old name `ACCOUNT_CRAWLER_DATA_DIR` is dropped, not kept as an
  alias, since the app is unreleased.
- **Empty `DATA_DIR` counts as unset**, so `DATA_DIR=` falls back to the
  default.
- **`HOST` defaults to `127.0.0.1`** to keep local runs private; the image
  overrides it to `0.0.0.0`.
- **Port 80 as non-root.** The image runs as `node`; Docker's default
  `net.ipv4.ip_unprivileged_port_start=0` permits this. Environments that
  disable it must set `PORT` to a port above 1023.
- **Build toolchain in the builder stage only**, because `better-sqlite3` has no
  prebuilt binary for the Node version and compiles from source.

## Risks / Trade-offs

- [Breaking rename of the env var and removal of the flag] → acceptable, no
  released users; documented in the README.

## Why

The server is being packaged as a Docker image. Containers are configured
through environment variables, not command-line arguments, so the `--data-dir`
option added in `add-data-dir-option` was the wrong mechanism. The server also
binds only to `127.0.0.1` and defaults to a random port, which does not work
inside a container.

## What Changes

- **BREAKING**: remove the `--data-dir` command-line option and all argument
  parsing. The data directory is now configured only with the `DATA_DIR`
  environment variable (default `~/.account-crawler`).
- **BREAKING**: rename `ACCOUNT_CRAWLER_DATA_DIR` to `DATA_DIR`.
- The listen port is configured with `PORT`; an invalid value is rejected with
  an error and a non-zero exit code. Without `PORT` a random free port is used
  (unchanged).
- The bind address is configured with `HOST` (default `127.0.0.1`).
- Add a server Docker image (`apps/server/Dockerfile`, built from the monorepo
  root with `turbo prune --docker`, `mise run docker:build`) that sets
  `PORT=80`, `HOST=0.0.0.0` and `DATA_DIR=/data`; users mount a volume at
  `/data`.

## Capabilities

### New Capabilities

- `server-container-technical`: container image and runtime environment
  configuration.

### Modified Capabilities

- `dashboard-settings-technical`: data directory is configured only by
  `DATA_DIR`; CLI option and its scenarios removed.
- `statement-sources-technical`: data directory reference updated.

## Impact

- `apps/server/src/bin.ts`, `apps/server/src/cli.ts` (replaced by `config.ts`)
  and their tests.
- New `apps/server/Dockerfile`, `.dockerignore`, `docker:build` mise task.
- `README.md` documentation.

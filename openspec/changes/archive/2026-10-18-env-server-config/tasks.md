## 1. Server configuration

- [x] 1.1 Replace `cli.ts` with `config.ts` (`resolveDataDir` from `DATA_DIR`,
      `resolvePort` from `PORT`) with unit tests covering every scenario
- [x] 1.2 Use them in `bin.ts`, reading `HOST`, and verify by running the built
      binary with `DATA_DIR=/tmp/ac-test PORT=8080`

## 2. Docker image

- [x] 2.1 `apps/server/Dockerfile` using `turbo prune --docker`, with `PORT=80`,
      `HOST=0.0.0.0`, `DATA_DIR=/data`, `.dockerignore`, and `docker:build` mise
      task; verify the image builds and serves the dashboard

## 3. Documentation and validation

- [x] 3.1 Update `README.md` and verify no `--data-dir` or
      `ACCOUNT_CRAWLER_DATA_DIR` references remain outside archived changes
- [x] 3.2 Run lint, type-check and tests via mise and verify they pass

# server-container-technical Specification

## Purpose

Defines the technical requirements for configuring the server through
environment variables and for packaging it as a Docker image.

## Requirements

### Requirement: Server Network Configuration Via Environment

The server binary SHALL read its listen port from the `PORT` environment
variable and its bind address from `HOST`. When `PORT` is unset or empty it
SHALL listen on a random free port; when `HOST` is unset it SHALL bind to
`127.0.0.1`. A `PORT` that is not an integer between 0 and 65535 SHALL cause the
binary to print an error, not start the server, and exit non-zero.

#### Scenario: Port from environment

- **WHEN** the binary is started with `PORT=8080`
- **THEN** the server listens on port 8080

#### Scenario: Invalid port

- **WHEN** the binary is started with `PORT=abc`
- **THEN** it prints an error, does not start the server, and exits non-zero

#### Scenario: Default bind address

- **WHEN** `HOST` is not set
- **THEN** the server binds to `127.0.0.1`

### Requirement: Server Docker Image

The repository SHALL provide `apps/server/Dockerfile`, built from the monorepo
root, that uses `turbo prune server --docker` to install dependencies and build
the server and dashboard in separate cache-friendly stages. The runtime image
SHALL run as a non-root user, set `HOST=0.0.0.0`, `PORT=80` and
`DATA_DIR=/data`, declare `/data` as a volume, and expose port 80. A
`docker:build` mise task SHALL build the image.

#### Scenario: Image serves the dashboard

- **WHEN** the image is run with port 80 published
- **THEN** the dashboard is served on the published port

#### Scenario: Data persists in the volume

- **WHEN** a volume is mounted at `/data` and the container is recreated
- **THEN** previously saved sources and settings are still available

### Requirement: Actual Settings Via Environment

The server binary SHALL read the Actual connection settings from the environment
variables `ACTUAL_SERVER_URL`, `ACTUAL_SERVER_PASSWORD`, `ACTUAL_SYNC_ID` and
`ACTUAL_ENCRYPTION_PASSWORD`. An unset or empty variable SHALL count as not
provided. Provided values SHALL take precedence over saved values per field,
SHALL be applied to all Actual operations, and SHALL be held in memory only. The
variables SHALL NOT have defaults in the Docker image. Error messages shown to
users SHALL NOT contain environment-provided passwords.

#### Scenario: Settings from environment

- **WHEN** the binary is started with all three required variables set
- **THEN** the server connects to Actual using them without any saved settings

#### Scenario: Empty variable ignored

- **WHEN** `ACTUAL_ENCRYPTION_PASSWORD` is set to an empty string
- **THEN** it is treated as not provided

#### Scenario: Invalid server URL

- **WHEN** the binary is started with `ACTUAL_SERVER_URL=ftp://x`
- **THEN** it prints an error, does not start the server, and exits non-zero

#### Scenario: Partial environment

- **WHEN** only `ACTUAL_SERVER_URL` is set
- **THEN** the server starts and the remaining settings come from the saved
  settings

#### Scenario: Password not leaked in errors

- **WHEN** a connection fails with `ACTUAL_SERVER_PASSWORD` set
- **THEN** the reason shown to the user does not contain the password

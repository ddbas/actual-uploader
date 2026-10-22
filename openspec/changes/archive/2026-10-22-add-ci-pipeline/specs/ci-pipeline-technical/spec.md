# ci-pipeline-technical Specification

## Purpose

Defines the technical requirements for the continuous integration pipeline that
verifies changes and publishes the server container image.

## ADDED Requirements

### Requirement: Verification On Every Branch

The pipeline SHALL run on every pull request and on every push to the default
branch, and SHALL NOT run on pushes to other branches (those are covered by
their pull request). It SHALL install tooling with mise and run the mise
`install`, `build` and `test` tasks, in that order. A failure in any step SHALL
fail the run.

#### Scenario: Pull request

- **WHEN** a pull request is opened or updated
- **THEN** the `install`, `build` and `test` tasks run and no image is published

#### Scenario: Push to non-default branch

- **WHEN** a commit is pushed to a non-default branch
- **THEN** the pipeline does not run on that push

#### Scenario: Failing test

- **WHEN** the `test` task exits non-zero
- **THEN** the run fails

### Requirement: Image Publication From Default Branch

On the default branch, after verification succeeds, the pipeline SHALL build the
server image from `apps/server/Dockerfile` and publish it to
`ghcr.io/<owner>/<repo>`. The default branch SHALL be determined from the
repository's settings, not hardcoded. Publication SHALL NOT occur when
verification fails.

#### Scenario: Default branch push

- **WHEN** a commit is pushed to the default branch and verification passes
- **THEN** the image is built and pushed to the GitHub Container Registry

#### Scenario: Verification fails on default branch

- **WHEN** verification fails on the default branch
- **THEN** no image is published

### Requirement: Image Tags

Each published image SHALL be tagged `latest` and with a tag derived from the
commit SHA, so every published image remains retrievable by commit.

#### Scenario: Tags on publish

- **WHEN** an image is published for commit `abc1234…`
- **THEN** it carries the tags `latest` and `sha-abc1234`

### Requirement: Least Privilege

The pipeline SHALL grant read-only repository access by default. Permission to
write packages SHALL be granted only to the publishing job, authenticating with
the workflow's built-in token.

#### Scenario: Verification job permissions

- **WHEN** the verification job runs
- **THEN** it has no package write permission

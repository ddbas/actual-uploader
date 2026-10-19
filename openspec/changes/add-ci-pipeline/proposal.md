## Why

Nothing validates changes or publishes the server image automatically. A CI
pipeline should verify every push and publish the image from the default branch.

## What Changes

- Add a GitHub Actions workflow that runs the mise `install`, `build` and `test`
  tasks on every push and pull request.
- On the default branch, after those pass, build the server Docker image and
  publish it to the GitHub Container Registry, tagged `latest` and by commit
  SHA.

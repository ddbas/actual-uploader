# Transaction Importer

This project implements a tool that allows users to upload their banking
statement files. It then parses the files and extracts the transaction data,
which is then automatically uploaded to the user's
[Actual Budget](https://actualbudget.org) server.

## Rules

1. NEVER skip git hooks without exclicit permission from the user. If a hook
   fails, fix it.
2. ALWAYS use Mise for running all tasks and dev tools.
3. ALWAYS use OpenSpec for proposing and documenting requirements.
4. Functional requirements and architectural/technical requirements must ALWAYS
   be in separate OpenSpec specs. They should NEVER be in the same spec.
5. ALWAYS commit and push your changes once you've completed a task.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)

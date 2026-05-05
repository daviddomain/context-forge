# AGENTS.md

This file is the repository entry point for coding agents working on
ContextForge.

## Source of Truth

- `MVP.md` is the product source of truth for future implementation work.
- `README.md` is the human-facing project overview.
- Future `.agent-context/project.snapshot.json` files are generated output.

Generated snapshots must not be edited manually. They are orientation only and
never replace reading the real source files.

Before making implementation changes, inspect the relevant source files directly
and validate assumptions against the current repository state.

## Current MVP Constraints

This repository is currently an early baseline for a future local Node.js and
TypeScript CLI tool.

Do not add these until a dedicated task asks for them:

- scanner implementation
- `contextforge:scan`
- generated `.agent-context/project.snapshot.json`
- MCP server
- SQLite or another persistent database
- watch mode
- Docker setup
- GitHub Actions or CI setup
- Git hooks
- Vite or frontend framework tooling
- scanner-specific dependencies such as `fast-glob`, `ts-morph` or `zod`

## Working Rules

- Keep changes minimal and aligned with the current task.
- Prefer plain Node.js and TypeScript unless the task explicitly expands scope.
- Do not introduce new dependencies without a clear task-driven reason.
- Report validation honestly. Do not claim a command was run if it was not.

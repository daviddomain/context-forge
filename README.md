# ContextForge

ContextForge is a local project-context tool for coding agents. It is intended
to generate a compact, deterministic repository snapshot so agents can orient
themselves before making changes.

This repository is currently an early MVP baseline. A local scan command writes
the deterministic project snapshot:

```bash
npm run contextforge:scan
```

The command creates `.agent-context/project.snapshot.json` with project metadata,
package scripts, dependencies, detected config files, Next.js App Router
routes, source-file imports/exports and a lightweight symbol index.

The output is formatted JSON with stable key order where practical. The default
snapshot intentionally does not include volatile fields such as `generatedAt`.

Symbol kinds and tags are intentionally heuristic. Tags such as
`client-component`, `server-component`, `route-handler`, `config`, `test`,
`schema`, `db-access` and `side-effect` are orientation hints only; they are
not guaranteed truth and do not replace reading the real source files.

`MVP.md` is the product source of truth for future implementation work.

`.agent-context/project.snapshot.json` is generated output. Generated snapshots
are orientation only and must not be edited manually.

## Agent Usage Contract

Coding agents may use the snapshot for orientation only.

Agents must not treat the snapshot as authoritative implementation detail. Before
editing code, an agent must inspect the real source files referenced by the
snapshot.

The snapshot may be stale, incomplete or heuristic. Agents should not manually
edit `.agent-context/project.snapshot.json`.

## Suggested AGENTS.md Usage

Projects that use ContextForge can add this guidance to their `AGENTS.md`:

```markdown
## ContextForge Usage

Before starting implementation work:

1. Run `npm run contextforge:scan` if available.
2. Read `.agent-context/project.snapshot.json`.
3. Use the snapshot only to identify likely relevant files, routes, scripts and conventions.
4. Read the real source files before editing.
5. Do not modify `.agent-context/project.snapshot.json` manually.
6. Validate changes with the repository's real scripts and tests.
```

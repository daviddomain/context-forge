# ContextForge

ContextForge is a local project-context tool for coding agents. It is intended
to generate a compact, deterministic repository snapshot so agents can orient
themselves before making changes.

This repository is currently an early MVP baseline. A local scan command is
available:

```bash
npm run contextforge:scan
```

The command prints a deterministic JSON snapshot with project metadata,
package scripts, dependencies, detected config files, Next.js App Router
routes, source-file imports/exports and a lightweight symbol index.

Symbol kinds and tags are intentionally heuristic. Tags such as
`client-component`, `server-component`, `route-handler`, `config`, `test`,
`schema`, `db-access` and `side-effect` are orientation hints only; they are
not guaranteed truth and do not replace reading the real source files.

`MVP.md` is the product source of truth for future implementation work.

Once scanner support exists, `.agent-context/project.snapshot.json` will be
generated output. Generated snapshots are orientation only and must not be
edited manually.

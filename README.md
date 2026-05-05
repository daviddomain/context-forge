# ContextForge

ContextForge is a local project-context tool for coding agents. It is intended
to generate a compact, deterministic repository snapshot so agents can orient
themselves before making changes.

This repository is currently an early MVP baseline. Scanner logic is not
implemented yet. A placeholder scan command is available:

```bash
npm run contextforge:scan
```

For now, the command exits successfully and prints that scanning is not
implemented yet.

`MVP.md` is the product source of truth for future implementation work.

Once scanner support exists, `.agent-context/project.snapshot.json` will be
generated output. Generated snapshots are orientation only and must not be
edited manually.

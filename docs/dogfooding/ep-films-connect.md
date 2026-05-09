# EP Films Connect Dogfooding

This note captures findings from running the current ContextForge MVP against
EP Films Connect, a real Next.js TypeScript App Router project.

## Target Project

- Project: EP Films Connect
- Project type: Next.js TypeScript application using the App Router
- Purpose: verify whether the MVP snapshot gives coding agents useful
  orientation data for a realistic application repository

## Scan Run

The scanner was run from the target repository root with the current MVP scan
command:

```bash
npm run contextforge:scan
```

The scan completed successfully and wrote:

```txt
.agent-context/project.snapshot.json
```

No scanner behavior changes were made as part of this dogfooding pass.

## Determinism Check

The scanner was run twice without repository changes between runs. The generated
snapshot hash stayed stable, confirming deterministic output for this target
under the tested conditions.

## Useful Snapshot Sections

The generated snapshot was useful for quickly identifying:

- Project metadata.
- Available npm scripts.
- Runtime dependencies and development dependencies.
- Detected configuration files.
- App Router pages and layouts.
- Route groups such as `(dashboard)` and `(website)`.
- Layout inheritance for pages.
- Source files with imports and exports.
- Lightweight symbols.
- Heuristic tags such as `client-component`, `server-component`, `schema`,
  `db-access` and `side-effect`.

These sections helped the snapshot work as an agent-readable repository map:
useful for orientation, but still requiring direct source-file inspection before
implementation changes.

## Follow-Up Candidates

The dogfooding run identified these concrete follow-up issue candidates:

- Improve HTTP method detection for route handlers using delegated or re-exported
  handlers.
- Improve symbol kind detection for uppercase constants.
- Make the scanner easier to run against external repositories.
- Consider refining noisy `side-effect` tags later.

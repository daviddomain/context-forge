# nextjs/saas-starter Dogfooding

This note captures findings from running the current ContextForge MVP against
`nextjs/saas-starter`, a public third-party Next.js TypeScript App Router
project.

## Target Project

- Project: `nextjs/saas-starter`
- Project type: Next.js TypeScript SaaS-style application using the App Router
- App Router location: root-level `app`
- Purpose: verify whether the MVP snapshot gives coding agents useful
  orientation data for a realistic third-party project

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

The generated snapshot from the external project is not committed here. No
scanner behavior changes were made as part of this dogfooding pass.

## Root-Level `app` Route Confirmation

The generated snapshot correctly detected routes from the root-level `app`
directory. Route groups such as `(dashboard)` and `(login)` were omitted from
the public route paths.

Examples:

```txt
app/(dashboard)/dashboard/page.tsx -> /dashboard
app/(dashboard)/pricing/page.tsx   -> /pricing
app/(login)/sign-in/page.tsx       -> /sign-in
```

This confirms that root-level `app` route detection worked as intended for this
target project.

## Useful Snapshot Sections

The generated snapshot was useful for quickly identifying:

- Project metadata.
- Next.js and TypeScript detection.
- Next.js version detection.
- npm scripts such as build, dev, start and Drizzle-related commands.
- Root-level `app` routes.
- Route groups such as `(dashboard)` and `(login)`.
- Public route paths with route-group segments omitted.
- Layout inheritance for nested dashboard routes.
- Route handlers for API routes.
- Exported HTTP methods for route handlers.
- Source files with imports and exports.
- Lightweight symbols.
- Heuristic tags such as `client-component`, `server-component`,
  `route-handler`, `db-access`, `schema` and `side-effect`.

These sections helped the snapshot work as an agent-readable repository map:
useful for orientation, but still requiring direct source-file inspection before
implementation changes.

## Follow-Up Candidates

The dogfooding run identified these concrete follow-up candidates:

- Treat Drizzle config files such as `drizzle.config.ts` as config files. In
  this run, `drizzle.config.ts` was indexed as normal source and tagged with
  `db-access` and `side-effect`, but for agent orientation it is primarily a
  config or tooling file.
- Verify package manager detection separately. The snapshot reported
  `packageManager` as `null`; this may be correct if the target project has no
  package-manager field and no lockfile, so it should remain an open
  verification point rather than a confirmed scanner bug.
- Consider future `tagReasons` support to explain noisy heuristic tags such as
  `side-effect`. This note records the need only as possible future work and
  does not specify or implement `tagReasons`.
- Refine symbol kind detection later. Some symbol kinds appeared imprecise, for
  example constants or initialized values being classified as functions.


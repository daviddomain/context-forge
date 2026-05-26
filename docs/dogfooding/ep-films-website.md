# e+p films Website Dogfooding

This note captures findings from the second ContextForge dogfooding run against
the e+p films website project.

## Target Project

- Project: e+p films website
- Snapshot project name: `nextjs_ep`
- Project type: Next.js TypeScript application using the App Router
- App Router location: `src/app`
- Package manager: npm
- Framework version: Next.js `^15.2.4`
- Purpose: verify that ContextForge can orient agents in a real Next.js project
  that uses `src/app` instead of a root-level `app` directory

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

## `src/app` Route Confirmation

The generated snapshot correctly detected routes from `src/app`, and the public
route paths did not include the physical `src` prefix.

Examples:

```txt
src/app/ai-hub/page.tsx                 -> /ai-hub
src/app/ai-hub/[slug]/page.tsx          -> /ai-hub/[slug]
src/app/api/draft-mode/enable/route.ts  -> /api/draft-mode/enable
src/app/studio/[[...tool]]/page.tsx     -> /studio/[[...tool]]
```

This confirms that `src/app` support works as intended for this target project.

## Useful Snapshot Sections

The generated snapshot was useful for quickly identifying:

- Project metadata.
- npm scripts.
- Runtime dependencies and development dependencies.
- Detected configuration files.
- Routes from `src/app`.
- The root layout from `src/app/layout.tsx`.
- Static pages such as `/`, `/about-us`, `/ai-hub`, `/behind-the-lens`,
  `/directors`, `/our-work`, `/privacy` and `/studio/[[...tool]]`.
- Dynamic routes such as `/ai-hub/[slug]`, `/behind-the-lens/[slug]`,
  `/directors/[slug]` and `/our-work/[slug]`.
- Route handlers such as `/api/draft-mode/enable` and
  `/api/draft-mode/disable`.
- Exported HTTP methods for route handlers.
- Source files with imports and exports.
- Lightweight symbols.
- Heuristic tags such as `client-component`, `server-component`,
  `route-handler`, `config`, `schema` and `side-effect`.

These sections helped the snapshot work as an agent-readable repository map:
useful for orientation, but still requiring direct source-file inspection before
implementation changes.

## Follow-Up Candidates

The dogfooding run identified these concrete follow-up issue candidates:

- Expand config file detection for Jest and Sanity config files, including
  `jest.config.ts`, `sanity.config.ts` and `sanity.cli.ts`.
- Avoid misleading `client-component` tags on known config files such as
  `sanity.config.ts`.
- Add lightweight tag reasons for heuristic tags such as `side-effect`.
- Improve schema tag detection for Sanity schema files under
  `src/sanity/schemaTypes/**`.

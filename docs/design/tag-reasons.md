# tagReasons for Heuristic Tags

## Status

Exploration note only. This document does not define an implemented snapshot
schema change.

## Problem

ContextForge tags are useful because they compress file-level signals into a
small orientation map. Tags such as `schema`, `db-access`, `config`,
`client-component`, `server-component` and `side-effect` help an agent decide
which files to inspect first.

The trade-off is that several tags are heuristic. A tag can be correct as a
signal while still being hard to interpret without knowing why it was assigned.
Dogfooding on `nextjs/saas-starter` showed this most clearly for
`side-effect`: layouts, middleware, route handlers, DB schema files, setup
scripts and config files can all receive the same tag for different reasons.

That ambiguity matters because the snapshot is only a map. If a tag looks more
precise than it is, an agent may over-trust it or spend time inspecting the
wrong files first.

## Tags That Would Benefit Most

The highest-value candidates are tags that combine broad signals or can appear
in many different parts of a project:

- `side-effect`: can come from runtime APIs, file-system imports, process
  environment access, database-related imports, setup code or route handlers.
- `db-access`: can be based on a DB-related path, a known package import or a
  local project utility name.
- `schema`: can be based on path names, exported symbol names or known schema
  package imports.
- `config`: can be based on exact known filenames or tool-specific config
  naming patterns.
- `client-component` and `server-component`: can be especially useful to
  explain when a tag is derived from a `"use client"` directive versus App
  Router file location.

Tags such as `test` and `route-handler` need less explanation because their
inputs are usually more concrete and easier to verify from the file path.

## Example

The `nextjs/saas-starter` run found that `drizzle.config.ts` was indexed as
normal source and tagged with both `db-access` and `side-effect`. The tags were
useful, but the file was primarily a tooling config file, so the agent needed
more context before deciding how much runtime weight to give those tags.

A minimal explanatory shape could look like this:

```json
{
  "path": "drizzle.config.ts",
  "kind": "source",
  "tags": ["db-access", "side-effect"],
  "tagReasons": {
    "db-access": ["imports drizzle-related package"],
    "side-effect": ["uses process.env"]
  }
}
```

For a route handler, the reasons might separate a strong file-structure signal
from a broad side-effect signal:

```json
{
  "path": "app/api/users/route.ts",
  "kind": "source",
  "tags": ["route-handler", "side-effect"],
  "tagReasons": {
    "route-handler": ["matches App Router route handler filename"],
    "side-effect": ["exports HTTP method handler"]
  }
}
```

## Snapshot Schema Options

There are three plausible places for reasons:

1. Inline on each file entry as `tagReasons`.
2. In a separate top-level section keyed by file path.
3. Outside the main deterministic snapshot as optional diagnostic output.

Inline reasons are easiest for agents to consume because the explanation is
next to the tag. They also make the main snapshot larger and would require a
schema change.

A top-level section keeps file entries smaller but adds another lookup step and
can make the snapshot harder to scan manually.

Optional diagnostic output keeps the main snapshot compact and avoids changing
the default schema, but agents would need to know when and how to ask for the
extra data.

## Determinism

If reasons are added, they should be deterministic in the same way the current
snapshot is deterministic:

- Use fixed reason strings, not generated prose.
- Sort tags and reason arrays consistently.
- Use stable object key order where practical.
- Do not include confidence scores unless they are derived from fixed rules.
- Do not include timestamps, scan duration or other volatile metadata.
- Keep reasons tied to explicit scanner rules, not to runtime observations.

Reasons should describe rule matches, not conclusions. For example, prefer
`"imports drizzle-related package"` over `"this file talks to the database"`.

## Snapshot Size

Reasons can bloat the snapshot quickly because every tagged file may repeat the
same strings. Possible size controls:

- Include reasons only for broad heuristic tags such as `side-effect`,
  `db-access` and `schema`.
- Limit each tag to one to three concise reason strings.
- Omit reasons for obvious structural tags such as `test` unless there is a
  concrete need.
- Consider a compact code-based representation later if repeated strings become
  a real problem.

The first implementation should prefer readable strings over coded reason IDs.
Reason IDs reduce size, but they require a dictionary and make the snapshot less
self-explanatory for agents and humans.

## Risks and Trade-Offs

Adding reasons would make heuristic tags easier to audit and could reduce
over-trust in broad tags such as `side-effect`.

The cost is schema complexity. Once reasons are in the main snapshot, downstream
agents and tools may start depending on the exact strings. That makes future
retuning harder unless the project treats reason text as best-effort diagnostic
metadata rather than a stable contract.

There is also a risk of false precision. A reason can explain why a scanner rule
matched, but it still does not prove the semantic role of the file. The
documentation should keep stating that the snapshot is orientation only and real
source files remain authoritative.

## Recommendation

Do not add `tagReasons` to the default v0.1 snapshot.

The idea is useful, but it should wait until ContextForge has more dogfooding
evidence about which tags are actually causing confusion. The next step should
be a narrow follow-up that prototypes reasons for only `side-effect`,
`db-access` and `schema`, either behind an explicit option or in a separate
diagnostic output. That keeps the v0.1 snapshot compact while preserving a clear
path to better tag explainability later.

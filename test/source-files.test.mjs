import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  createSourceFileIndexEntry,
  extractExports,
  extractImports,
  extractSymbols,
  scanSourceFiles
} from "../dist/contextforge/source-files.js";
import { scanRepository } from "../dist/contextforge/scan-cli.js";

test("extracts static, side-effect, dynamic and re-export imports", () => {
  assert.deepEqual(
    extractImports(`
      import React from "react";
      import type { Thing } from "@/types";
      import "./setup";
      const mod = await import("next/dynamic");
      export { Button } from "@/components/button";
    `),
    ["./setup", "@/components/button", "@/types", "next/dynamic", "react"]
  );
});

test("extracts compact export names", () => {
  assert.deepEqual(
    extractExports(`
      export default function Page() {}
      export async function loader() {}
      export const value = 1;
      export type User = { id: string };
      export interface Props {}
      export { value as renamed, type Props };
      export * from "./shared";
    `),
    ["*", "default", "loader", "Props", "renamed", "User", "value"]
  );
});

test("creates source file index entries with kind and heuristic tags", () => {
  assert.deepEqual(
    createSourceFileIndexEntry(
      "app/users/page.tsx",
      `"use client";
       import { db } from "@/server/db";
       export default function UsersPage() {
         return fetch("/api/users");
       }`
    ),
    {
      path: "app/users/page.tsx",
      kind: "source",
      tags: ["client-component", "db-access", "side-effect"],
      imports: ["@/server/db"],
      exports: ["default"]
    }
  );
});

test("classifies known Jest and Sanity config files without component tags", () => {
  assert.deepEqual(
    [
      createSourceFileIndexEntry("jest.config.ts", "export default {};"),
      createSourceFileIndexEntry(
        "sanity.config.ts",
        `"use client";\nexport default {};`
      ),
      createSourceFileIndexEntry("sanity.cli.ts", "export default {};")
    ].map(({ path, kind, tags }) => ({ path, kind, tags })),
    [
      {
        path: "jest.config.ts",
        kind: "config",
        tags: ["config"]
      },
      {
        path: "sanity.config.ts",
        kind: "config",
        tags: ["config"]
      },
      {
        path: "sanity.cli.ts",
        kind: "config",
        tags: ["config"]
      }
    ]
  );
});

test("extracts lightweight symbols with export status and heuristic tags", () => {
  assert.deepEqual(
    extractSymbols(
      "app/users/page.tsx",
      `"use client";
import { z } from "zod";
type LocalValue = string;
export interface UserProps {}
export const userSchema = z.object({ id: z.string() });
export function helper() {}
const UsersPage = () => <main />;
export default UsersPage;`
    ),
    [
      {
        name: "helper",
        kind: "function",
        file: "app/users/page.tsx",
        exported: true,
        tags: ["client-component", "schema"]
      },
      {
        name: "LocalValue",
        kind: "type",
        file: "app/users/page.tsx",
        exported: false,
        tags: ["client-component", "schema"]
      },
      {
        name: "UserProps",
        kind: "interface",
        file: "app/users/page.tsx",
        exported: true,
        tags: ["client-component", "schema"]
      },
      {
        name: "userSchema",
        kind: "schema",
        file: "app/users/page.tsx",
        exported: true,
        tags: ["client-component", "schema"]
      },
      {
        name: "UsersPage",
        kind: "component",
        file: "app/users/page.tsx",
        exported: true,
        tags: ["client-component", "schema"]
      }
    ]
  );
});

test("classifies constant-style variables as constants in TypeScript and TSX files", () => {
  assert.deepEqual(
    extractSymbols(
      "src/navigation.ts",
      `export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24;
const SIDEBAR_COOKIE_NAME = "sidebar_state";`
    ).map(({ name, kind, exported }) => ({ name, kind, exported })),
    [
      {
        name: "LOCALE_COOKIE_MAX_AGE",
        kind: "constant",
        exported: true
      },
      {
        name: "SIDEBAR_COOKIE_NAME",
        kind: "constant",
        exported: false
      }
    ]
  );

  assert.deepEqual(
    extractSymbols(
      "src/components/sidebar.tsx",
      `export const SIDEBAR_WIDTH = "16rem";
const MOBILE_BREAKPOINT = 768;`
    ).map(({ name, kind, exported }) => ({ name, kind, exported })),
    [
      {
        name: "MOBILE_BREAKPOINT",
        kind: "constant",
        exported: false
      },
      {
        name: "SIDEBAR_WIDTH",
        kind: "constant",
        exported: true
      }
    ]
  );
});

test("keeps PascalCase TSX symbols classified as components", () => {
  assert.deepEqual(
    extractSymbols(
      "src/components/sidebar.tsx",
      `function AppSidebar() {
  return <Sidebar />;
}

const ProjectSwitcher = () => {
  return <DropdownMenu />;
};`
    ).map(({ name, kind, exported }) => ({ name, kind, exported })),
    [
      {
        name: "AppSidebar",
        kind: "component",
        exported: false
      },
      {
        name: "ProjectSwitcher",
        kind: "component",
        exported: false
      }
    ]
  );
});

test("keeps uppercase arrow function symbols classified as functions", () => {
  assert.deepEqual(
    extractSymbols(
      "app/api/users/route.ts",
      `export const GET = async () => {};
const POST = function () {};`
    ).map(({ name, kind, exported }) => ({ name, kind, exported })),
    [
      {
        name: "GET",
        kind: "function",
        exported: true
      },
      {
        name: "POST",
        kind: "function",
        exported: false
      }
    ]
  );
});

test("marks locally aliased exports as exported symbols", () => {
  assert.deepEqual(
    extractSymbols(
      "src/components/button.tsx",
      `const InternalButton = () => null;
export { InternalButton as Button };`
    ),
    [
      {
        name: "InternalButton",
        kind: "component",
        file: "src/components/button.tsx",
        exported: true,
        tags: []
      }
    ]
  );
});

test("detects multiline arrow functions as function symbols", () => {
  assert.deepEqual(
    extractSymbols(
      "src/load-users.ts",
      `const loadUsers = (
  userId
) => fetch(\`/api/users/\${userId}\`);`
    ),
    [
      {
        name: "loadUsers",
        kind: "function",
        file: "src/load-users.ts",
        exported: false,
        tags: ["side-effect"]
      }
    ]
  );
});

test("detects schema suffix names as schema symbols", () => {
  assert.deepEqual(
    extractSymbols(
      "src/user-schema.ts",
      `export const userSchema = createSchema();
export type UserSchema = typeof userSchema;`
    ),
    [
      {
        name: "userSchema",
        kind: "schema",
        file: "src/user-schema.ts",
        exported: true,
        tags: ["schema"]
      },
      {
        name: "UserSchema",
        kind: "schema",
        file: "src/user-schema.ts",
        exported: true,
        tags: ["schema"]
      }
    ]
  );
});

test("tags Sanity schema type files as schema", () => {
  assert.deepEqual(
    [
      createSourceFileIndexEntry(
        "src/sanity/schemaTypes/post.ts",
        "export default {};"
      ),
      createSourceFileIndexEntry(
        "src/sanity/schemaTypes/author.tsx",
        "export const author = {};"
      ),
      createSourceFileIndexEntry(
        "sanity/schemaTypes/project.js",
        "export default {};"
      ),
      createSourceFileIndexEntry(
        "sanity/schemaTypes/index.jsx",
        "export { project } from './project';"
      )
    ].map(({ path, tags }) => ({ path, tags })),
    [
      {
        path: "src/sanity/schemaTypes/post.ts",
        tags: ["schema"]
      },
      {
        path: "src/sanity/schemaTypes/author.tsx",
        tags: ["schema"]
      },
      {
        path: "sanity/schemaTypes/project.js",
        tags: ["schema"]
      },
      {
        path: "sanity/schemaTypes/index.jsx",
        tags: ["schema"]
      }
    ]
  );
});

test("scans source files deterministically and excludes generated directories", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-source-files-"));

  try {
    mkdirSync(join(rootDir, "src"), { recursive: true });
    mkdirSync(join(rootDir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(rootDir, ".agent-context"), { recursive: true });
    mkdirSync(join(rootDir, "dist"), { recursive: true });
    mkdirSync(join(rootDir, "app", "api", "users"), { recursive: true });

    writeFileSync(join(rootDir, "package.json"), JSON.stringify({}));
    writeFileSync(join(rootDir, "src", "b.test.ts"), "export const testValue = 1;");
    writeFileSync(join(rootDir, "src", "a.ts"), "import fs from 'node:fs'; export { fs };");
    writeFileSync(join(rootDir, "next.config.ts"), "export default {};");
    writeFileSync(join(rootDir, "jest.config.ts"), "export default {};");
    writeFileSync(join(rootDir, "sanity.config.ts"), `"use client";\nexport default {};`);
    writeFileSync(join(rootDir, "sanity.cli.ts"), "export default {};");
    writeFileSync(join(rootDir, "node_modules", "pkg", "index.js"), "export const ignored = true;");
    writeFileSync(join(rootDir, ".agent-context", "snapshot.ts"), "export const ignored = true;");
    writeFileSync(join(rootDir, "dist", "index.js"), "export const ignored = true;");
    writeFileSync(
      join(rootDir, "app", "api", "users", "route.ts"),
      "export async function GET() {}"
    );

    assert.deepEqual(scanSourceFiles(rootDir), [
      {
        path: "app/api/users/route.ts",
        kind: "source",
        tags: ["route-handler"],
        imports: [],
        exports: ["GET"]
      },
      {
        path: "jest.config.ts",
        kind: "config",
        tags: ["config"],
        imports: [],
        exports: ["default"]
      },
      {
        path: "next.config.ts",
        kind: "config",
        tags: ["config"],
        imports: [],
        exports: ["default"]
      },
      {
        path: "sanity.cli.ts",
        kind: "config",
        tags: ["config"],
        imports: [],
        exports: ["default"]
      },
      {
        path: "sanity.config.ts",
        kind: "config",
        tags: ["config"],
        imports: [],
        exports: ["default"]
      },
      {
        path: "src/a.ts",
        kind: "source",
        tags: ["side-effect"],
        imports: ["node:fs"],
        exports: ["fs"]
      },
      {
        path: "src/b.test.ts",
        kind: "test",
        tags: ["test"],
        imports: [],
        exports: ["testValue"]
      }
    ]);

    assert.deepEqual(
      scanRepository(rootDir).files.map((file) => file.path),
      [
        "app/api/users/route.ts",
        "jest.config.ts",
        "next.config.ts",
        "sanity.cli.ts",
        "sanity.config.ts",
        "src/a.ts",
        "src/b.test.ts"
      ]
    );

    assert.deepEqual(
      scanRepository(rootDir).symbols.map((symbol) => ({
        name: symbol.name,
        kind: symbol.kind,
        file: symbol.file,
        exported: symbol.exported
      })),
      [
        {
          name: "GET",
          kind: "function",
          file: "app/api/users/route.ts",
          exported: true
        },
        {
          name: "default",
          kind: "unknown",
          file: "jest.config.ts",
          exported: true
        },
        {
          name: "default",
          kind: "unknown",
          file: "next.config.ts",
          exported: true
        },
        {
          name: "default",
          kind: "unknown",
          file: "sanity.cli.ts",
          exported: true
        },
        {
          name: "default",
          kind: "unknown",
          file: "sanity.config.ts",
          exported: true
        },
        {
          name: "testValue",
          kind: "constant",
          file: "src/b.test.ts",
          exported: true
        }
      ]
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

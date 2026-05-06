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
        path: "next.config.ts",
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
      ["app/api/users/route.ts", "next.config.ts", "src/a.ts", "src/b.test.ts"]
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
          file: "next.config.ts",
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

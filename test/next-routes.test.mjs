import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  detectHttpMethods,
  routeSegmentsToPublicPath,
  scanNextAppRoutes
} from "../dist/contextforge/next-routes.js";
import { scanRepository } from "../dist/contextforge/scan-cli.js";

test("converts app route segments to public paths", () => {
  assert.equal(routeSegmentsToPublicPath([]), "/");
  assert.equal(routeSegmentsToPublicPath(["blog", "[id]"]), "/blog/[id]");
  assert.equal(
    routeSegmentsToPublicPath(["docs", "[...slug]"]),
    "/docs/[...slug]"
  );
  assert.equal(
    routeSegmentsToPublicPath(["docs", "[[...slug]]"]),
    "/docs/[[...slug]]"
  );
  assert.equal(
    routeSegmentsToPublicPath(["(dashboard)", "settings"]),
    "/settings"
  );
});

test("detects exported route handler HTTP methods in stable order", () => {
  assert.deepEqual(
    detectHttpMethods(`
      export async function POST() {}
      export const GET = async () => {};
      export function DELETE() {}
      export { handler as OPTIONS };
      function OPTIONS() {}
    `),
    ["GET", "POST", "DELETE", "OPTIONS"]
  );
});

test("detects delegated route handler HTTP method exports", () => {
  assert.deepEqual(
    detectHttpMethods(`
      const handler = toNextJsHandler(auth);

      export const { GET, POST } = handler;
      export const PATCH = handler.PATCH;
      export { deleteHandler as DELETE } from "@/routes/delete";
      export { HEAD, optionsHandler as OPTIONS };
    `),
    ["GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"]
  );
});

test("scans Next.js App Router pages, layouts and route handlers", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-routes-"));

  try {
    writeFileSync(join(rootDir, "package.json"), JSON.stringify({}));

    mkdirSync(join(rootDir, "app", "(dashboard)", "settings"), {
      recursive: true
    });
    mkdirSync(join(rootDir, "app", "api", "users", "[id]"), {
      recursive: true
    });
    mkdirSync(join(rootDir, "app", "docs", "[[...slug]]"), {
      recursive: true
    });

    writeFileSync(join(rootDir, "app", "layout.tsx"), "export default Layout;");
    writeFileSync(join(rootDir, "app", "page.tsx"), "export default Home;");
    writeFileSync(
      join(rootDir, "app", "(dashboard)", "layout.tsx"),
      "export default DashboardLayout;"
    );
    writeFileSync(
      join(rootDir, "app", "(dashboard)", "settings", "page.tsx"),
      "export default Settings;"
    );
    writeFileSync(
      join(rootDir, "app", "api", "users", "[id]", "route.ts"),
      "export async function GET() {}\nexport const PATCH = async () => {};"
    );
    writeFileSync(
      join(rootDir, "app", "docs", "[[...slug]]", "page.ts"),
      "export default Docs;"
    );

    assert.deepEqual(scanNextAppRoutes(rootDir), {
      routes: [
        {
          path: "/",
          type: "layout",
          file: "app/(dashboard)/layout.tsx",
          routeSegments: ["(dashboard)"]
        },
        {
          path: "/",
          type: "layout",
          file: "app/layout.tsx",
          routeSegments: []
        },
        {
          path: "/",
          type: "page",
          file: "app/page.tsx",
          layouts: ["app/layout.tsx"]
        },
        {
          path: "/api/users/[id]",
          type: "route-handler",
          file: "app/api/users/[id]/route.ts",
          methods: ["GET", "PATCH"]
        },
        {
          path: "/docs/[[...slug]]",
          type: "page",
          file: "app/docs/[[...slug]]/page.ts",
          layouts: ["app/layout.tsx"]
        },
        {
          path: "/settings",
          type: "page",
          file: "app/(dashboard)/settings/page.tsx",
          layouts: ["app/layout.tsx", "app/(dashboard)/layout.tsx"]
        }
      ],
      warnings: []
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("returns a warning instead of crashing when app directory is missing", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-routes-"));

  try {
    writeFileSync(join(rootDir, "package.json"), JSON.stringify({}));

    assert.deepEqual(scanNextAppRoutes(rootDir), {
      routes: [],
      warnings: ["No Next.js App Router directory found at app/."]
    });
    assert.deepEqual(scanRepository(rootDir).warnings, [
      "No Next.js App Router directory found at app/."
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

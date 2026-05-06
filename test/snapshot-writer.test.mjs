import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  createProjectSnapshot,
  scanRepository,
  writeProjectSnapshot
} from "../dist/contextforge/scan-cli.js";

test("creates a deterministic project snapshot file", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-snapshot-"));

  try {
    mkdirSync(join(rootDir, "app", "api", "health"), { recursive: true });
    mkdirSync(join(rootDir, "src"), { recursive: true });

    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "snapshot-app",
        scripts: {
          test: "node --test",
          build: "next build"
        },
        dependencies: {
          react: "^19.0.0",
          next: "^16.0.0"
        },
        devDependencies: {
          typescript: "^5.7.2"
        }
      })
    );
    writeFileSync(join(rootDir, "package-lock.json"), "{}");
    writeFileSync(join(rootDir, "tsconfig.json"), "{}");
    writeFileSync(join(rootDir, ".env.local"), "SECRET_TOKEN=super-secret");
    writeFileSync(
      join(rootDir, "app", "api", "health", "route.ts"),
      "export function GET() {}"
    );
    writeFileSync(join(rootDir, "src", "index.ts"), "export const value = 1;");

    const firstSnapshot = createProjectSnapshot(scanRepository(rootDir));
    const snapshotPath = writeProjectSnapshot(rootDir, firstSnapshot);
    const firstWrittenSnapshot = readFileSync(snapshotPath, "utf8");

    const secondSnapshot = createProjectSnapshot(scanRepository(rootDir));
    writeProjectSnapshot(rootDir, secondSnapshot);
    const secondWrittenSnapshot = readFileSync(snapshotPath, "utf8");

    assert.equal(firstWrittenSnapshot, secondWrittenSnapshot);
    assert.equal(existsSync(join(rootDir, ".agent-context")), true);
    assert.equal(firstWrittenSnapshot.includes("generatedAt"), false);
    assert.equal(firstWrittenSnapshot.includes("super-secret"), false);
    assert.deepEqual(JSON.parse(firstWrittenSnapshot), {
      snapshotVersion: "0.1.0",
      project: {
        name: "snapshot-app",
        rootPath: ".",
        packageManager: "npm",
        language: "typescript",
        framework: "next",
        frameworkVersion: "^16.0.0"
      },
      scripts: {
        build: "next build",
        test: "node --test"
      },
      dependencies: {
        runtime: ["next", "react"],
        dev: ["typescript"]
      },
      configs: [
        { type: "package", file: "package.json" },
        { type: "typescript", file: "tsconfig.json" }
      ],
      routes: [
        {
          path: "/api/health",
          type: "route-handler",
          file: "app/api/health/route.ts",
          methods: ["GET"]
        }
      ],
      files: [
        {
          path: "app/api/health/route.ts",
          kind: "source",
          tags: ["route-handler"],
          imports: [],
          exports: ["GET"]
        },
        {
          path: "src/index.ts",
          kind: "source",
          tags: [],
          imports: [],
          exports: ["value"]
        }
      ],
      symbols: [
        {
          name: "GET",
          kind: "function",
          file: "app/api/health/route.ts",
          exported: true,
          tags: ["route-handler"]
        },
        {
          name: "value",
          kind: "constant",
          file: "src/index.ts",
          exported: true,
          tags: []
        }
      ]
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

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
  main,
  resolveScanRoot,
  scanRepository,
  writeProjectSnapshot
} from "../dist/contextforge/scan-cli.js";

function writeMinimalProject(rootDir, name) {
  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify({
      name,
      scripts: {
        test: "node --test"
      }
    })
  );
}

function captureMain(args, cwd) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  const logs = [];
  const warnings = [];
  const errors = [];

  try {
    process.exitCode = undefined;
    console.log = (message) => logs.push(String(message));
    console.warn = (message) => warnings.push(String(message));
    console.error = (message) => errors.push(String(message));

    main(args, cwd);

    return {
      logs,
      warnings,
      errors,
      exitCode: process.exitCode
    };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
}

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

test("resolves the current working directory when no target path is provided", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-default-root-"));

  try {
    writeMinimalProject(rootDir, "default-root-app");

    const result = captureMain([], rootDir);
    const snapshotPath = join(rootDir, ".agent-context", "project.snapshot.json");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

    assert.equal(resolveScanRoot([], rootDir), rootDir);
    assert.equal(result.exitCode, undefined);
    assert.deepEqual(result.errors, []);
    assert.equal(existsSync(snapshotPath), true);
    assert.equal(snapshot.project.name, "default-root-app");
    assert.deepEqual(result.logs, [
      `ContextForge snapshot written to ${snapshotPath}`
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("scans an explicit target path and writes the snapshot there", () => {
  const cwd = mkdtempSync(join(tmpdir(), "context-forge-cwd-"));
  const targetDir = mkdtempSync(join(tmpdir(), "context-forge-target-"));

  try {
    writeMinimalProject(cwd, "cwd-app");
    writeMinimalProject(targetDir, "target-app");

    const result = captureMain([targetDir], cwd);
    const targetSnapshotPath = join(
      targetDir,
      ".agent-context",
      "project.snapshot.json"
    );
    const cwdSnapshotPath = join(cwd, ".agent-context", "project.snapshot.json");
    const snapshot = JSON.parse(readFileSync(targetSnapshotPath, "utf8"));

    assert.equal(resolveScanRoot([targetDir], cwd), targetDir);
    assert.equal(result.exitCode, undefined);
    assert.deepEqual(result.errors, []);
    assert.equal(existsSync(targetSnapshotPath), true);
    assert.equal(existsSync(cwdSnapshotPath), false);
    assert.equal(snapshot.project.name, "target-app");
    assert.deepEqual(result.logs, [
      `ContextForge snapshot written to ${targetSnapshotPath}`
    ]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  }
});

test("reports a clear error when the explicit target path has no package.json", () => {
  const cwd = mkdtempSync(join(tmpdir(), "context-forge-cwd-"));
  const targetDir = mkdtempSync(join(tmpdir(), "context-forge-missing-package-"));

  try {
    writeMinimalProject(cwd, "cwd-app");

    const result = captureMain([targetDir], cwd);

    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.logs, []);
    assert.equal(result.errors.length, 1);
    assert.match(
      result.errors[0],
      new RegExp(`ContextForge scan failed: Missing package\\.json at .*${targetDir.replaceAll("\\", "\\\\")}`)
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  }
});

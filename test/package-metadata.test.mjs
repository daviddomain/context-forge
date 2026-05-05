import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { extractPackageMetadata } from "../dist/contextforge/package-metadata.js";
import { readPackageMetadata } from "../dist/contextforge/scan-cli.js";

test("extracts sorted package metadata facts", () => {
  const metadata = extractPackageMetadata({
    hasPackageLock: true,
    hasTsConfig: true,
    packageJson: {
      name: "example-app",
      scripts: {
        test: "node --test",
        build: "next build"
      },
      dependencies: {
        react: "^19.0.0",
        next: "^16.0.0"
      },
      devDependencies: {
        vitest: "^3.0.0",
        typescript: "^5.7.2"
      }
    }
  });

  assert.deepEqual(metadata, {
    project: {
      name: "example-app",
      packageManager: "npm",
      language: "typescript",
      framework: "next"
    },
    scripts: {
      build: "next build",
      test: "node --test"
    },
    dependencies: {
      runtime: ["next", "react"],
      dev: ["typescript", "vitest"]
    }
  });
});

test("uses empty collections and null detections for missing optional data", () => {
  const metadata = extractPackageMetadata({
    hasPackageLock: false,
    hasTsConfig: false,
    packageJson: {}
  });

  assert.deepEqual(metadata, {
    project: {
      name: null,
      packageManager: null,
      language: null,
      framework: null
    },
    scripts: {},
    dependencies: {
      runtime: [],
      dev: []
    }
  });
});

test("reads package metadata from a repository root", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    writeFileSync(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "temp-app",
        scripts: {
          start: "next start"
        },
        dependencies: {
          next: "^16.0.0"
        }
      })
    );
    writeFileSync(join(rootDir, "package-lock.json"), "{}");
    writeFileSync(join(rootDir, "tsconfig.json"), "{}");

    assert.deepEqual(readPackageMetadata(rootDir), {
      project: {
        name: "temp-app",
        packageManager: "npm",
        language: "typescript",
        framework: "next"
      },
      scripts: {
        start: "next start"
      },
      dependencies: {
        runtime: ["next"],
        dev: []
      }
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("fails clearly when package.json is missing", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    assert.throws(
      () => readPackageMetadata(rootDir),
      new RegExp(`Missing package\\.json at .*${rootDir.replaceAll("\\", "\\\\")}`)
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

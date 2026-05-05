import assert from "node:assert/strict";
import test from "node:test";

import { extractPackageMetadata } from "../dist/contextforge/package-metadata.js";

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

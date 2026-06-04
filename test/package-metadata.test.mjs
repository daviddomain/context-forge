import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { detectConfigFiles } from "../dist/contextforge/config-files.js";
import { extractPackageMetadata } from "../dist/contextforge/package-metadata.js";
import {
  readConfigFiles,
  readPackageMetadata
} from "../dist/contextforge/scan-cli.js";

test("extracts sorted package metadata facts", () => {
  const metadata = extractPackageMetadata({
    packageManagerLockfiles: ["package-lock.json"],
    hasTsConfig: true,
    configFiles: [
      { type: "typescript", file: "tsconfig.json" },
      { type: "package", file: "package.json" }
    ],
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
      rootPath: ".",
      packageManager: "npm",
      language: "typescript",
      framework: "next",
      frameworkVersion: "^16.0.0"
    },
    configs: [
      { type: "package", file: "package.json" },
      { type: "typescript", file: "tsconfig.json" }
    ],
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
    packageManagerLockfiles: [],
    hasTsConfig: false,
    packageJson: {}
  });

  assert.deepEqual(metadata, {
    project: {
      name: null,
      rootPath: ".",
      packageManager: null,
      language: null,
      framework: null,
      frameworkVersion: null
    },
    configs: [],
    scripts: {},
    dependencies: {
      runtime: [],
      dev: []
    }
  });
});

test("detects package managers from common lockfiles", () => {
  const cases = [
    ["package-lock.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ];

  for (const [lockfile, packageManager] of cases) {
    const metadata = extractPackageMetadata({
      packageManagerLockfiles: [lockfile],
      hasTsConfig: false,
      packageJson: {}
    });

    assert.equal(metadata.project.packageManager, packageManager);
  }
});

test("uses deterministic package manager precedence for multiple lockfiles", () => {
  const metadata = extractPackageMetadata({
    packageManagerLockfiles: [
      "bun.lock",
      "yarn.lock",
      "package-lock.json",
      "pnpm-lock.yaml"
    ],
    hasTsConfig: false,
    packageJson: {}
  });

  assert.equal(metadata.project.packageManager, "pnpm");
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
    writeFileSync(join(rootDir, ".env.example"), "PUBLIC_ORIGIN=http://localhost");
    writeFileSync(join(rootDir, ".env.local"), "SECRET_TOKEN=super-secret");
    writeFileSync(join(rootDir, "next.config.mjs"), "export default {};");

    assert.deepEqual(readPackageMetadata(rootDir), {
      project: {
        name: "temp-app",
        rootPath: ".",
        packageManager: "npm",
        language: "typescript",
        framework: "next",
        frameworkVersion: "^16.0.0"
      },
      configs: [
        { type: "env-example", file: ".env.example" },
        { type: "next", file: "next.config.mjs" },
        { type: "package", file: "package.json" },
        { type: "typescript", file: "tsconfig.json" }
      ],
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

test("reads package manager lockfiles from a repository root", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    writeFileSync(join(rootDir, "package.json"), "{}");
    writeFileSync(join(rootDir, "pnpm-lock.yaml"), "");

    assert.equal(readPackageMetadata(rootDir).project.packageManager, "pnpm");
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("ignores directories with package manager lockfile names", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    writeFileSync(join(rootDir, "package.json"), "{}");
    mkdirSync(join(rootDir, "pnpm-lock.yaml"));

    assert.equal(readPackageMetadata(rootDir).project.packageManager, null);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("detects only safe config files in stable order", () => {
  assert.deepEqual(
    detectConfigFiles([
      ".env.production",
      "tailwind.config.ts",
      "package.json",
      ".env.example",
      ".env.local",
      "components.json"
    ]),
    [
      { type: "env-example", file: ".env.example" },
      { type: "components", file: "components.json" },
      { type: "package", file: "package.json" },
      { type: "tailwind", file: "tailwind.config.ts" }
    ]
  );
});

test("does not list secret-bearing env files from the repository root", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    writeFileSync(join(rootDir, ".env"), "TOKEN=secret");
    writeFileSync(join(rootDir, ".env.development"), "TOKEN=secret");
    writeFileSync(join(rootDir, ".env.example"), "TOKEN=");
    writeFileSync(join(rootDir, "postcss.config.js"), "export default {};");

    assert.deepEqual(readConfigFiles(rootDir), [
      { type: "env-example", file: ".env.example" },
      { type: "postcss", file: "postcss.config.js" }
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("does not list directories with config file names", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "context-forge-test-"));

  try {
    mkdirSync(join(rootDir, "tsconfig.json"));
    writeFileSync(join(rootDir, "components.json"), "{}");

    assert.deepEqual(readConfigFiles(rootDir), [
      { type: "components", file: "components.json" }
    ]);
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

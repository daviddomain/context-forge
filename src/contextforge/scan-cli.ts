import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SAFE_CONFIG_FILE_NAMES, detectConfigFiles } from "./config-files.js";
import { scanNextAppRoutes, type AppRoute } from "./next-routes.js";
import {
  extractPackageMetadata,
  PACKAGE_MANAGER_LOCKFILES,
  type PackageJson,
  type PackageMetadata
} from "./package-metadata.js";
import {
  scanSourceFiles,
  scanSourceSymbols,
  type SourceFileIndexEntry,
  type SourceSymbolIndexEntry
} from "./source-files.js";

export type ScanResult = PackageMetadata & {
  routes: AppRoute[];
  files: SourceFileIndexEntry[];
  symbols: SourceSymbolIndexEntry[];
  warnings: string[];
};

export type ProjectSnapshot = {
  snapshotVersion: "0.1.0";
  project: PackageMetadata["project"];
  scripts: PackageMetadata["scripts"];
  dependencies: PackageMetadata["dependencies"];
  configs: PackageMetadata["configs"];
  routes: AppRoute[];
  files: SourceFileIndexEntry[];
  symbols: SourceSymbolIndexEntry[];
};

export const SNAPSHOT_VERSION = "0.1.0";
export const SNAPSHOT_DIR = ".agent-context";
export const SNAPSHOT_FILE = "project.snapshot.json";

export function resolveScanRoot(args: string[], cwd: string): string {
  const [targetPath] = args;

  if (targetPath === undefined) {
    return cwd;
  }

  return resolve(cwd, targetPath);
}

export function readPackageMetadata(rootDir: string): PackageMetadata {
  const packageJsonPath = join(rootDir, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  ) as PackageJson;

  return extractPackageMetadata({
    packageJson,
    packageManagerLockfiles: PACKAGE_MANAGER_LOCKFILES.filter(({ fileName }) =>
      isFile(join(rootDir, fileName))
    ).map(({ fileName }) => fileName),
    hasTsConfig: existsSync(join(rootDir, "tsconfig.json")),
    configFiles: readConfigFiles(rootDir)
  });
}

export function readConfigFiles(rootDir: string) {
  const existingConfigFileNames = SAFE_CONFIG_FILE_NAMES.filter((fileName) =>
    isFile(join(rootDir, fileName))
  );

  return detectConfigFiles(existingConfigFileNames);
}

export function scanRepository(rootDir: string): ScanResult {
  const metadata = readPackageMetadata(rootDir);
  const routeScan = scanNextAppRoutes(rootDir);

  return {
    ...metadata,
    routes: routeScan.routes,
    files: scanSourceFiles(rootDir),
    symbols: scanSourceSymbols(rootDir),
    warnings: routeScan.warnings
  };
}

export function createProjectSnapshot(scanResult: ScanResult): ProjectSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    project: scanResult.project,
    scripts: scanResult.scripts,
    dependencies: scanResult.dependencies,
    configs: scanResult.configs,
    routes: scanResult.routes,
    files: scanResult.files,
    symbols: scanResult.symbols
  };
}

export function writeProjectSnapshot(
  rootDir: string,
  snapshot: ProjectSnapshot
): string {
  const snapshotDir = join(rootDir, SNAPSHOT_DIR);
  const snapshotPath = join(snapshotDir, SNAPSHOT_FILE);

  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return snapshotPath;
}

export function runScan(rootDir: string): {
  snapshotPath: string;
  warnings: string[];
} {
  const result = scanRepository(rootDir);
  const snapshot = createProjectSnapshot(result);
  const snapshotPath = writeProjectSnapshot(rootDir, snapshot);

  return {
    snapshotPath,
    warnings: result.warnings
  };
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function main(args = process.argv.slice(2), cwd = process.cwd()): void {
  try {
    const rootDir = resolveScanRoot(args, cwd);
    const result = runScan(rootDir);

    for (const warning of result.warnings) {
      console.warn(`ContextForge scan warning: ${warning}`);
    }

    console.log(`ContextForge snapshot written to ${result.snapshotPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ContextForge scan failed: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined) {
  const entrypointUrl = pathToFileURL(process.argv[1]).href;

  if (import.meta.url === entrypointUrl) {
    main();
  }
}

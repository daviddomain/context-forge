import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { SAFE_CONFIG_FILE_NAMES, detectConfigFiles } from "./config-files.js";
import { scanNextAppRoutes, type AppRoute } from "./next-routes.js";
import {
  extractPackageMetadata,
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
    hasPackageLock: existsSync(join(rootDir, "package-lock.json")),
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

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function main(rootDir = process.cwd()): void {
  try {
    const result = scanRepository(rootDir);

    for (const warning of result.warnings) {
      console.warn(`ContextForge scan warning: ${warning}`);
    }

    console.log(JSON.stringify(result, null, 2));
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

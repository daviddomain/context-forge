import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  extractPackageMetadata,
  type PackageJson,
  type PackageMetadata
} from "./package-metadata.js";

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
    hasTsConfig: existsSync(join(rootDir, "tsconfig.json"))
  });
}

export function main(rootDir = process.cwd()): void {
  try {
    const metadata = readPackageMetadata(rootDir);
    console.log(JSON.stringify(metadata, null, 2));
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

import type { ConfigFile } from "./config-files.js";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type PackageManagerLockfile =
  | "pnpm-lock.yaml"
  | "package-lock.json"
  | "yarn.lock"
  | "bun.lock"
  | "bun.lockb";
export type ProjectLanguage = "typescript";
export type ProjectFramework = "next";

export type PackageJson = {
  name?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
};

export type ProjectMetadata = {
  name: string | null;
  rootPath: ".";
  packageManager: PackageManager | null;
  language: ProjectLanguage | null;
  framework: ProjectFramework | null;
  frameworkVersion: string | null;
};

export type PackageMetadata = {
  project: ProjectMetadata;
  configs: ConfigFile[];
  scripts: Record<string, string>;
  dependencies: {
    runtime: string[];
    dev: string[];
  };
};

export type PackageMetadataInput = {
  packageJson: PackageJson;
  packageManagerLockfiles: PackageManagerLockfile[];
  hasTsConfig: boolean;
  configFiles?: ConfigFile[];
};

export function extractPackageMetadata(
  input: PackageMetadataInput
): PackageMetadata {
  const runtimeDependencies = dependencyNames(input.packageJson.dependencies);
  const devDependencies = dependencyNames(input.packageJson.devDependencies);
  const frameworkVersion = dependencyVersion(input.packageJson.dependencies, "next");

  return {
    project: {
      name:
        typeof input.packageJson.name === "string"
          ? input.packageJson.name
          : null,
      rootPath: ".",
      packageManager: detectPackageManager(input.packageManagerLockfiles),
      language: input.hasTsConfig ? "typescript" : null,
      framework: runtimeDependencies.includes("next") ? "next" : null,
      frameworkVersion
    },
    configs: [...(input.configFiles ?? [])].sort(compareConfigFilePath),
    scripts: scriptEntries(input.packageJson.scripts),
    dependencies: {
      runtime: runtimeDependencies,
      dev: devDependencies
    }
  };
}

export function detectPackageManager(
  lockfiles: readonly PackageManagerLockfile[]
): PackageManager | null {
  const lockfileSet = new Set(lockfiles);

  for (const { fileName, packageManager } of PACKAGE_MANAGER_LOCKFILES) {
    if (lockfileSet.has(fileName)) {
      return packageManager;
    }
  }

  return null;
}

export const PACKAGE_MANAGER_LOCKFILES: readonly {
  fileName: PackageManagerLockfile;
  packageManager: PackageManager;
}[] = [
  { fileName: "pnpm-lock.yaml", packageManager: "pnpm" },
  { fileName: "package-lock.json", packageManager: "npm" },
  { fileName: "yarn.lock", packageManager: "yarn" },
  { fileName: "bun.lock", packageManager: "bun" },
  { fileName: "bun.lockb", packageManager: "bun" }
];

function dependencyVersion(value: unknown, dependencyName: string): string | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const version = value[dependencyName];

  return typeof version === "string" ? version : null;
}

function scriptEntries(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function dependencyNames(value: unknown): string[] {
  if (!isPlainObject(value)) {
    return [];
  }

  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function compareConfigFilePath(left: ConfigFile, right: ConfigFile): number {
  return left.file < right.file ? -1 : left.file > right.file ? 1 : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type PackageManager = "npm";
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
  packageManager: PackageManager | null;
  language: ProjectLanguage | null;
  framework: ProjectFramework | null;
};

export type PackageMetadata = {
  project: ProjectMetadata;
  scripts: Record<string, string>;
  dependencies: {
    runtime: string[];
    dev: string[];
  };
};

export type PackageMetadataInput = {
  packageJson: PackageJson;
  hasPackageLock: boolean;
  hasTsConfig: boolean;
};

export function extractPackageMetadata(
  input: PackageMetadataInput
): PackageMetadata {
  const runtimeDependencies = dependencyNames(input.packageJson.dependencies);
  const devDependencies = dependencyNames(input.packageJson.devDependencies);

  return {
    project: {
      name:
        typeof input.packageJson.name === "string"
          ? input.packageJson.name
          : null,
      packageManager: input.hasPackageLock ? "npm" : null,
      language: input.hasTsConfig ? "typescript" : null,
      framework: runtimeDependencies.includes("next") ? "next" : null
    },
    scripts: scriptEntries(input.packageJson.scripts),
    dependencies: {
      runtime: runtimeDependencies,
      dev: devDependencies
    }
  };
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

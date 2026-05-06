export type ConfigFile = {
  type: ConfigFileType;
  file: string;
};

export type ConfigFileType =
  | "components"
  | "env-example"
  | "eslint"
  | "next"
  | "package"
  | "postcss"
  | "tailwind"
  | "typescript";

export const SAFE_CONFIG_FILE_NAMES = [
  ".env.example",
  "components.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "package.json",
  "postcss.config.js",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json"
] as const;

export type SafeConfigFileName = (typeof SAFE_CONFIG_FILE_NAMES)[number];

const SAFE_CONFIG_FILE_NAME_SET = new Set<string>(SAFE_CONFIG_FILE_NAMES);

export function detectConfigFiles(fileNames: string[]): ConfigFile[] {
  return fileNames
    .filter(isSafeConfigFileName)
    .sort((left, right) => left.localeCompare(right))
    .map((file) => ({ type: detectConfigFileType(file), file }));
}

export function isSafeConfigFileName(fileName: string): fileName is SafeConfigFileName {
  return SAFE_CONFIG_FILE_NAME_SET.has(fileName);
}

function detectConfigFileType(fileName: SafeConfigFileName): ConfigFileType {
  if (fileName === ".env.example") {
    return "env-example";
  }

  if (fileName === "components.json") {
    return "components";
  }

  if (fileName.startsWith("eslint.config.")) {
    return "eslint";
  }

  if (fileName.startsWith("next.config.")) {
    return "next";
  }

  if (fileName === "package.json") {
    return "package";
  }

  if (fileName.startsWith("postcss.config.")) {
    return "postcss";
  }

  if (fileName.startsWith("tailwind.config.")) {
    return "tailwind";
  }

  return "typescript";
}

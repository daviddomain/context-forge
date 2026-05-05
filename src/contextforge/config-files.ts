export type ConfigFile = {
  path: string;
};

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
    .map((path) => ({ path }));
}

export function isSafeConfigFileName(fileName: string): fileName is SafeConfigFileName {
  return SAFE_CONFIG_FILE_NAME_SET.has(fileName);
}

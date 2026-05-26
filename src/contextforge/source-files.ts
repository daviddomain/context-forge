import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";

export type SourceFileKind = "source" | "test" | "config";

export type SourceSymbolKind =
  | "component"
  | "function"
  | "constant"
  | "type"
  | "interface"
  | "schema"
  | "unknown";

export type SourceFileIndexEntry = {
  path: string;
  kind: SourceFileKind;
  tags: string[];
  imports: string[];
  exports: string[];
};

export type SourceSymbolIndexEntry = {
  name: string;
  kind: SourceSymbolKind;
  file: string;
  exported: boolean;
  tags: string[];
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".git",
  ".agent-context"
]);

const CONFIG_FILE_NAMES = new Set([
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "jest.config.ts",
  "sanity.config.ts",
  "sanity.cli.ts"
]);

const DB_IMPORTS = new Set(["@prisma/client", "drizzle-orm"]);

export function scanSourceFiles(rootDir: string): SourceFileIndexEntry[] {
  return collectSourceFilePaths(rootDir)
    .map((path) => {
      const source = readFileSync(join(rootDir, path), "utf8");

      return createSourceFileIndexEntry(path, source);
    })
    .sort(compareSourceFiles);
}

export function scanSourceSymbols(rootDir: string): SourceSymbolIndexEntry[] {
  return collectSourceFilePaths(rootDir)
    .flatMap((path) => {
      const source = readFileSync(join(rootDir, path), "utf8");

      return extractSymbols(path, source);
    })
    .sort(compareSourceSymbols);
}

export function createSourceFileIndexEntry(
  path: string,
  source: string
): SourceFileIndexEntry {
  const imports = extractImports(source);
  const kind = detectFileKind(path);
  const tags = detectTags(path, source, imports, kind);

  return {
    path,
    kind,
    tags,
    imports,
    exports: extractExports(source)
  };
}

export function extractSymbols(
  path: string,
  source: string
): SourceSymbolIndexEntry[] {
  const imports = extractImports(source);
  const kind = detectFileKind(path);
  const fileTags = detectTags(path, source, imports, kind);
  const exportedNames = new Set([
    ...extractExports(source),
    ...extractLocalExportNames(source)
  ]);
  const defaultExportedIdentifier = extractDefaultExportedIdentifier(source);

  if (defaultExportedIdentifier !== null) {
    exportedNames.add(defaultExportedIdentifier);
  }

  const symbols = [
    ...extractDeclaredSymbols(path, source, exportedNames, fileTags),
    ...extractDefaultAnonymousSymbols(path, source, fileTags)
  ];

  return uniqueSymbols(symbols).sort(compareSourceSymbols);
}

export function extractImports(source: string): string[] {
  return sortedUnique([
    ...matches(
      source,
      /\bimport\s+(?:type\s+)?[\w*{}\s,$]+?\s+from\s+["']([^"']+)["']/g
    ),
    ...matches(source, /\bimport\s+["']([^"']+)["']/g),
    ...matches(source, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...matches(
      source,
      /\bexport\s+(?:type\s+)?(?:\*|[\w*{}\s,$]+?)\s+from\s+["']([^"']+)["']/g
    )
  ]);
}

export function extractExports(source: string): string[] {
  const exports = [
    ...matches(source, /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g),
    ...matches(source, /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g),
    ...matches(source, /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g),
    ...matches(source, /\bexport\s+(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)
  ];

  if (/\bexport\s+default\b/.test(source)) {
    exports.push("default");
  }

  if (/\bexport\s+\*\s+from\s+["'][^"']+["']/.test(source)) {
    exports.push("*");
  }

  for (const exportList of matches(source, /\bexport\s+(?:type\s+)?\{([^}]+)\}/g)) {
    exports.push(...parseExportList(exportList));
  }

  return sortedUnique(exports);
}

function collectSourceFilePaths(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name)
  );

  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
        paths.push(...collectSourceFilePaths(rootDir, entryPath));
      }

      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      paths.push(normalizePath(relative(rootDir, entryPath)));
    }
  }

  return paths;
}

function detectFileKind(path: string): SourceFileKind {
  if (isTestFile(path)) {
    return "test";
  }

  if (CONFIG_FILE_NAMES.has(basename(path))) {
    return "config";
  }

  return "source";
}

function detectTags(
  path: string,
  source: string,
  imports: string[],
  kind: SourceFileKind
): string[] {
  const tags: string[] = [];

  if (kind === "test") {
    tags.push("test");
  }

  if (kind === "config") {
    tags.push("config");
  }

  if (kind !== "config") {
    if (isClientComponent(source)) {
      tags.push("client-component");
    } else if (isAppRouterComponent(path)) {
      tags.push("server-component");
    }
  }

  if (isRouteHandler(path)) {
    tags.push("route-handler");
  }

  if (isLikelySchema(path, source, imports)) {
    tags.push("schema");
  }

  if (
    imports.some(isDbImport) ||
    /\b(db|database|prisma|drizzle)\b/i.test(path)
  ) {
    tags.push("db-access");
  }

  if (hasObviousSideEffect(source, imports)) {
    tags.push("side-effect");
  }

  return sortedUnique(tags);
}

function isClientComponent(source: string): boolean {
  return /^\s*["']use client["'];?/.test(source);
}

function isAppRouterComponent(path: string): boolean {
  return /(^|\/)app\/.*\/?(page|layout)\.(ts|tsx|js|jsx)$/.test(path);
}

function isRouteHandler(path: string): boolean {
  return /(^|\/)app\/.*\/?route\.(ts|js)$/.test(path);
}

function isTestFile(path: string): boolean {
  return (
    /(^|\/|\\)__tests__(\/|\\)/.test(path) ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(path)
  );
}

function isLikelySchema(
  path: string,
  source: string,
  imports: string[] = extractImports(source)
): boolean {
  return (
    /\bschema\b/i.test(path) ||
    imports.some((value) =>
      ["zod", "yup", "valibot", "superstruct"].includes(value)
    ) ||
    /(?:^|[^\w$])(?:z|yup)\.object\s*\(/.test(source)
  );
}

function extractDeclaredSymbols(
  path: string,
  source: string,
  exportedNames: Set<string>,
  fileTags: string[]
): SourceSymbolIndexEntry[] {
  const symbols: SourceSymbolIndexEntry[] = [];

  for (const match of source.matchAll(
    /^(export\s+default\s+|export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm
  )) {
    const name = match[2] ?? "";

    symbols.push(
      createSymbol({
        name,
        kind: isLikelyComponentName(name, path) ? "component" : "function",
        file: path,
        exported: Boolean(match[1]) || exportedNames.has(name),
        fileTags
      })
    );
  }

  for (const match of source.matchAll(
    /^(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:[:=]|$)/gm
  )) {
    const name = match[2] ?? "";

    symbols.push(
      createSymbol({
        name,
        kind: detectVariableSymbolKind(name, path, source, match.index ?? 0),
        file: path,
        exported: Boolean(match[1]) || exportedNames.has(name),
        fileTags
      })
    );
  }

  for (const match of source.matchAll(
    /^(export\s+)?type\s+([A-Za-z_$][\w$]*)\b/gm
  )) {
    const name = match[2] ?? "";

    symbols.push(
      createSymbol({
        name,
        kind: isSchemaName(name) ? "schema" : "type",
        file: path,
        exported: Boolean(match[1]) || exportedNames.has(name),
        fileTags
      })
    );
  }

  for (const match of source.matchAll(
    /^(export\s+)?interface\s+([A-Za-z_$][\w$]*)\b/gm
  )) {
    const name = match[2] ?? "";

    symbols.push(
      createSymbol({
        name,
        kind: isSchemaName(name) ? "schema" : "interface",
        file: path,
        exported: Boolean(match[1]) || exportedNames.has(name),
        fileTags
      })
    );
  }

  for (const match of source.matchAll(
    /^(export\s+)?class\s+([A-Za-z_$][\w$]*)\b/gm
  )) {
    const name = match[2] ?? "";

    symbols.push(
      createSymbol({
        name,
        kind: "unknown",
        file: path,
        exported: Boolean(match[1]) || exportedNames.has(name),
        fileTags
      })
    );
  }

  return symbols;
}

function extractDefaultAnonymousSymbols(
  path: string,
  source: string,
  fileTags: string[]
): SourceSymbolIndexEntry[] {
  if (
    !/\bexport\s+default\s+(?:async\s+)?(?:function|class)?\s*(?:\(|\{|async\b)/.test(
      source
    )
  ) {
    return [];
  }

  return [
    createSymbol({
      name: "default",
      kind: isAppRouterComponent(path) ? "component" : "unknown",
      file: path,
      exported: true,
      fileTags
    })
  ];
}

function extractDefaultExportedIdentifier(source: string): string | null {
  const match = /\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;?/.exec(source);

  return match?.[1] ?? null;
}

function extractLocalExportNames(source: string): string[] {
  return sortedUnique(
    matches(source, /\bexport\s+(?:type\s+)?\{([^}]+)\}/g).flatMap(
      parseLocalExportList
    )
  );
}

function createSymbol(input: {
  name: string;
  kind: SourceSymbolKind;
  file: string;
  exported: boolean;
  fileTags: string[];
}): SourceSymbolIndexEntry {
  const tags =
    input.kind === "schema" ? ["schema", ...input.fileTags] : input.fileTags;

  return {
    name: input.name,
    kind: input.kind,
    file: input.file,
    exported: input.exported,
    tags: sortedUnique(tags)
  };
}

function detectVariableSymbolKind(
  name: string,
  path: string,
  source: string,
  matchIndex: number
): SourceSymbolKind {
  const declarationSnippet = source.slice(matchIndex, matchIndex + 240);

  if (
    isSchemaName(name) ||
    /(?:^|[^\w$])(?:z|yup)\.object\s*\(/.test(declarationSnippet)
  ) {
    return "schema";
  }

  if (isLikelyComponentName(name, path)) {
    return "component";
  }

  if (/=>\s*|function\b/.test(declarationSnippet)) {
    return "function";
  }

  if (isConstantStyleName(name)) {
    return "constant";
  }

  return "constant";
}

function isLikelyComponentName(name: string, path: string): boolean {
  return (
    /\.(tsx|jsx)$/.test(path) &&
    /^[A-Z][A-Za-z0-9_$]*$/.test(name) &&
    !isConstantStyleName(name)
  );
}

function isConstantStyleName(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

function isSchemaName(name: string): boolean {
  return /schema/i.test(name);
}

function isDbImport(value: string): boolean {
  return DB_IMPORTS.has(value) || /\b(prisma|drizzle|database|db)\b/i.test(value);
}

function hasObviousSideEffect(source: string, imports: string[]): boolean {
  return (
    /\b(fetch|process\.env|new Date)\b/.test(source) ||
    imports.some(
      (value) => value === "fs" || value === "node:fs" || isDbImport(value)
    )
  );
}

function parseExportList(exportList: string): string[] {
  return exportList
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^type\s+/, ""))
    .map((item) => {
      const aliasMatch = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(item);

      return aliasMatch?.[1] ?? item;
    })
    .map((item) => item.trim())
    .filter((item) => /^[A-Za-z_$][\w$]*$/.test(item));
}

function parseLocalExportList(exportList: string): string[] {
  return exportList
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^type\s+/, ""))
    .map((item) => item.split(/\s+as\s+/)[0]?.trim() ?? "")
    .filter((item) => /^[A-Za-z_$][\w$]*$/.test(item));
}

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? "");
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function uniqueSymbols(
  symbols: SourceSymbolIndexEntry[]
): SourceSymbolIndexEntry[] {
  const uniqueByKey = new Map<string, SourceSymbolIndexEntry>();

  for (const symbol of symbols) {
    uniqueByKey.set(
      `${symbol.file}\0${symbol.name}\0${symbol.kind}`,
      symbol
    );
  }

  return [...uniqueByKey.values()];
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function compareSourceFiles(
  left: SourceFileIndexEntry,
  right: SourceFileIndexEntry
): number {
  return left.path.localeCompare(right.path);
}

function compareSourceSymbols(
  left: SourceSymbolIndexEntry,
  right: SourceSymbolIndexEntry
): number {
  return (
    left.file.localeCompare(right.file) ||
    left.name.localeCompare(right.name) ||
    left.kind.localeCompare(right.kind)
  );
}

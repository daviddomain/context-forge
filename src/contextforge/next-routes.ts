import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type AppRouteType = "page" | "layout" | "route-handler";

export type AppRoute = {
  path: string;
  type: AppRouteType;
  file: string;
  layouts?: string[];
  methods?: HttpMethod[];
};

export type NextRouteScanResult = {
  routes: AppRoute[];
  warnings: string[];
};

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

const PAGE_FILE_NAMES = new Set([
  "page.tsx",
  "page.ts",
  "page.jsx",
  "page.js"
]);

const LAYOUT_FILE_NAMES = new Set([
  "layout.tsx",
  "layout.ts",
  "layout.jsx",
  "layout.js"
]);

const ROUTE_HANDLER_FILE_NAMES = new Set(["route.ts", "route.js"]);

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
];

type RouteFile = {
  path: string;
  segments: string[];
  fileName: string;
};

export function scanNextAppRoutes(rootDir: string): NextRouteScanResult {
  const appDir = join(rootDir, "app");

  if (!isDirectory(appDir)) {
    return {
      routes: [],
      warnings: ["No Next.js App Router directory found at app/."]
    };
  }

  return {
    routes: collectRouteFiles(rootDir, appDir)
      .map((routeFile) => routeFileToRoute(routeFile, rootDir, appDir))
      .sort(compareRoutes),
    warnings: []
  };
}

export function routeSegmentsToPublicPath(segments: string[]): string {
  const publicSegments = segments.filter((segment) => !isRouteGroup(segment));

  if (publicSegments.length === 0) {
    return "/";
  }

  return `/${publicSegments.join("/")}`;
}

export function detectHttpMethods(source: string): HttpMethod[] {
  return HTTP_METHODS.filter((method) =>
    [
      `\\bexport\\s+(?:async\\s+)?function\\s+${method}\\b`,
      `\\bexport\\s+(?:const|let|var)\\s+${method}\\b`,
      `\\bexport\\s*\\{[^}]*\\b(?:${method}|as\\s+${method})\\b[^}]*\\}`
    ].some((pattern) => new RegExp(pattern).test(source))
  );
}

function collectRouteFiles(
  rootDir: string,
  currentDir: string,
  segments: string[] = []
): RouteFile[] {
  const entries = readdirSync(currentDir, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name)
  );

  const routeFiles: RouteFile[] = [];

  for (const entry of entries) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      routeFiles.push(
        ...collectRouteFiles(rootDir, entryPath, [...segments, entry.name])
      );
      continue;
    }

    if (
      entry.isFile() &&
      (PAGE_FILE_NAMES.has(entry.name) ||
        LAYOUT_FILE_NAMES.has(entry.name) ||
        ROUTE_HANDLER_FILE_NAMES.has(entry.name))
    ) {
      routeFiles.push({
        path: normalizePath(relative(rootDir, entryPath)),
        segments,
        fileName: entry.name
      });
    }
  }

  return routeFiles;
}

function routeFileToRoute(
  routeFile: RouteFile,
  rootDir: string,
  appDir: string
): AppRoute {
  const path = routeSegmentsToPublicPath(routeFile.segments);

  if (PAGE_FILE_NAMES.has(routeFile.fileName)) {
    return {
      path,
      type: "page",
      file: routeFile.path,
      layouts: inheritedLayouts(rootDir, appDir, routeFile.segments)
    };
  }

  if (LAYOUT_FILE_NAMES.has(routeFile.fileName)) {
    return {
      path,
      type: "layout",
      file: routeFile.path
    };
  }

  return {
    path,
    type: "route-handler",
    file: routeFile.path,
    methods: detectHttpMethods(readFileSync(join(rootDir, routeFile.path), "utf8"))
  };
}

function inheritedLayouts(
  rootDir: string,
  appDir: string,
  segments: string[]
): string[] {
  const layouts: string[] = [];

  for (let index = 0; index <= segments.length; index += 1) {
    const dir = join(appDir, ...segments.slice(0, index));
    const layoutFileName = layoutFileNameInDirectory(dir);

    if (layoutFileName !== null) {
      layouts.push(
        normalizePath(relative(rootDir, join(dir, layoutFileName)))
      );
    }
  }

  return layouts;
}

function layoutFileNameInDirectory(dir: string): string | null {
  for (const fileName of LAYOUT_FILE_NAMES) {
    if (isFile(join(dir, fileName))) {
      return fileName;
    }
  }

  return null;
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function compareRoutes(left: AppRoute, right: AppRoute): number {
  return (
    left.path.localeCompare(right.path) ||
    left.type.localeCompare(right.type) ||
    left.file.localeCompare(right.file)
  );
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

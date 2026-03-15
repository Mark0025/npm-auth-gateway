import "server-only";

import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";

type ScannedFunction = {
  name: string;
  desc: string;
  file: string;
};

type ScannedComponent = {
  name: string;
  desc: string;
  file: string;
};

type ScannedRoute = {
  path: string;
  type: "dynamic" | "static" | "api" | "proxy" | "redirect";
  desc: string;
};

/**
 * Extract exported functions with their JSDoc from a TypeScript file.
 * Matches: /** description * / \n export [async] function name(
 */
function extractExports(
  content: string,
  file: string,
): ScannedFunction[] {
  const results: ScannedFunction[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const exportMatch = line.match(
      /^export\s+(?:async\s+)?function\s+(\w+)/,
    );
    if (!exportMatch) continue;

    const name = exportMatch[1];
    // Look for JSDoc on the line(s) above
    let desc = "";
    for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
      const prev = lines[j].trim();
      if (prev.startsWith("/**") && prev.endsWith("*/")) {
        desc = prev.slice(3, -2).trim();
        break;
      }
      if (prev.endsWith("*/")) {
        // Multi-line JSDoc — find the start
        for (let k = j; k >= 0 && k >= j - 10; k--) {
          if (lines[k].trim().startsWith("/**")) {
            desc = lines
              .slice(k, j + 1)
              .map((l) => l.trim())
              .join(" ")
              .replace(/\/\*\*\s*/, "")
              .replace(/\s*\*\//, "")
              .replace(/\s*\*\s*/g, " ")
              .trim();
            break;
          }
        }
        break;
      }
      if (prev === "" || prev.startsWith("//")) continue;
      break; // Non-comment, non-empty line — no JSDoc
    }

    results.push({ name, desc, file });
  }

  return results;
}

/**
 * Extract the component name and JSDoc from a component file.
 * Matches: /** description * / \n export [default] [async] function Name(
 */
function extractComponent(
  content: string,
  file: string,
): ScannedComponent | null {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/,
    );
    if (!match) continue;

    const name = match[1];
    let desc = "";
    // Look for JSDoc above
    for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
      const prev = lines[j].trim();
      if (prev.startsWith("/**") && prev.endsWith("*/")) {
        desc = prev.slice(3, -2).trim();
        break;
      }
      if (prev === "" || prev.startsWith("//")) continue;
      break;
    }

    return { name, desc, file };
  }

  return null;
}

/** Resolve the src directory path — works in both dev and Docker */
function getSrcDir(): string {
  // In Docker, the app is at /app/src
  // In dev, process.cwd() is the project root
  const cwd = process.cwd();
  return join(cwd, "src");
}

/** Scan all server action files and extract exported functions with JSDoc */
export async function scanServerActions(): Promise<ScannedFunction[]> {
  const dir = join(getSrcDir(), "actions");
  const results: ScannedFunction[] = [];

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const content = await readFile(join(dir, file), "utf-8");
      results.push(...extractExports(content, `actions/${file}`));
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results;
}

/** Scan npm-api.ts and extract all exported functions with JSDoc */
export async function scanNpmApiFunctions(): Promise<ScannedFunction[]> {
  const file = join(getSrcDir(), "lib", "npm-api.ts");
  try {
    const content = await readFile(file, "utf-8");
    return extractExports(content, "lib/npm-api.ts");
  } catch {
    return [];
  }
}

/** Scan all lib files and extract exported functions with JSDoc */
export async function scanLibFunctions(): Promise<ScannedFunction[]> {
  const dir = join(getSrcDir(), "lib");
  const results: ScannedFunction[] = [];

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      if (file === "npm-api.ts") continue; // scanned separately
      if (file === "utils.ts") continue; // not interesting
      const content = await readFile(join(dir, file), "utf-8");
      results.push(...extractExports(content, `lib/${file}`));
    }
  } catch {
    // Directory doesn't exist
  }

  return results;
}

/** Scan all component files (excluding ui/) and extract names + JSDoc */
export async function scanClientComponents(): Promise<ScannedComponent[]> {
  const dir = join(getSrcDir(), "components");
  const results: ScannedComponent[] = [];

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      const content = await readFile(join(dir, file), "utf-8");
      const isClient = content.includes('"use client"');
      if (!isClient) continue; // only client components
      const component = extractComponent(content, `components/${file}`);
      if (component) results.push(component);
    }
  } catch {
    // Directory doesn't exist
  }

  return results;
}

/** Scan all Server Components (non-"use client" components) */
export async function scanServerComponents(): Promise<ScannedComponent[]> {
  const dir = join(getSrcDir(), "components");
  const results: ScannedComponent[] = [];

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      const content = await readFile(join(dir, file), "utf-8");
      const isClient = content.includes('"use client"');
      if (isClient) continue; // skip client components
      const component = extractComponent(content, `components/${file}`);
      if (component) results.push(component);
    }
  } catch {
    // Directory doesn't exist
  }

  return results;
}

/** Scan app directory for routes (page.tsx and route.ts files) */
export async function scanRoutes(): Promise<ScannedRoute[]> {
  const appDir = join(getSrcDir(), "app");
  const routes: ScannedRoute[] = [];

  async function walk(dir: string, routePath: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const segment = entry.name;
          // Route groups don't add to URL
          const urlSegment = segment.startsWith("(") ? "" : `/${segment}`;
          await walk(join(dir, segment), routePath + urlSegment);
        }

        if (entry.name === "page.tsx") {
          const content = await readFile(join(dir, entry.name), "utf-8");
          const isDynamic =
            content.includes("force-dynamic") ||
            content.includes("await ") ||
            content.includes("async ");
          const desc = extractFirstComment(content);
          routes.push({
            path: routePath || "/",
            type: isDynamic ? "dynamic" : "static",
            desc,
          });
        }

        if (entry.name === "route.ts") {
          const content = await readFile(join(dir, entry.name), "utf-8");
          const desc = extractFirstComment(content);
          const isProxy = routePath.includes("admin");
          routes.push({
            path: routePath,
            type: isProxy ? "proxy" : "api",
            desc,
          });
        }
      }
    } catch {
      // Can't read directory
    }
  }

  await walk(appDir, "");

  // Sort: / first, then alphabetically
  routes.sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.localeCompare(b.path);
  });

  return routes;
}

/** Extract the first JSDoc or // comment from file content */
function extractFirstComment(content: string): string {
  // Try JSDoc first (single-line)
  const jsdoc = content.match(/\/\*\*\s*([^*](?:[^*]|\*(?!\/))*)\s*\*\//);
  if (jsdoc) return jsdoc[1].replace(/\s*\*\s*/g, " ").trim();

  // Try single-line comment after imports
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") && !trimmed.includes("eslint")) {
      return trimmed.slice(2).trim();
    }
  }

  return "";
}

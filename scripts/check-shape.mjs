#!/usr/bin/env node
// Mechanical shape rules that are cheaper to check than to review.
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set([
  "node_modules",
  "dist",
  "out",
  "build",
  "coverage",
  "storybook-static",
  ".git",
  ".vite",
  "test-results",
  "playwright-report",
  "release",
]);
const SOURCE = /\.(ts|tsx|mjs|js)$/;
const MAX_LINES = 900;
const OBSERVE_ALLOWED = "apps/desktop/src/renderer/src/store/snapshotStore.ts";
const LORO_ALLOWED = "packages/core/src/loro/";
const MONEY_ALLOWED = "packages/core/src/money.ts";
const FS_ALLOWED = ["apps/desktop/src/main/", "scripts/"];

/** @param {string} dir @returns {Promise<string[]>} */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (SOURCE.test(entry.name)) files.push(path);
  }
  return files;
}

const problems = [];
const observeSites = [];
const files = await walk(root);

for (const file of files) {
  const rel = relative(root, file);
  if (rel === "scripts/check-shape.mjs") continue;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n").length;
  const isTest = /\.(test|spec)\.(ts|tsx)$/.test(rel);

  if (lines > MAX_LINES) {
    problems.push(`${rel}: ${lines} lines (limit ${MAX_LINES}); look for a seam`);
  }

  if (/\bobserve\(/.test(text) && !rel.startsWith(LORO_ALLOWED) && !isTest) {
    observeSites.push(rel);
  }

  if (/from\s+["']loro-crdt["']/.test(text) && !rel.startsWith(LORO_ALLOWED)) {
    problems.push(`${rel}: imports loro-crdt; only packages/core/src/loro may touch Loro`);
  }

  if (/nodeIntegration\s*:\s*true/.test(text)) {
    problems.push(`${rel}: nodeIntegration must stay false`);
  }

  if (!isTest && rel !== MONEY_ALLOWED) {
    if (/\bparseFloat\s*\(/.test(text) || /\.toFixed\s*\(/.test(text)) {
      problems.push(`${rel}: floats are not money; use packages/core/src/money.ts`);
    }
  }

  if (rel.startsWith("apps/") && !isTest) {
    if (
      /\bfetch\s*\(/.test(text) ||
      /\bXMLHttpRequest\b/.test(text) ||
      /\bWebSocket\b/.test(text)
    ) {
      problems.push(`${rel}: the app makes no network calls`);
    }
  }

  if (/from\s+["']node:fs(\/promises)?["']/.test(text)) {
    const allowed = isTest || FS_ALLOWED.some((prefix) => rel.startsWith(prefix));
    if (!allowed)
      problems.push(`${rel}: node:fs belongs in the main process, not the renderer or core`);
  }

  if (rel.startsWith("packages/core/") && !isTest && /\bconsole\.log\s*\(/.test(text)) {
    problems.push(`${rel}: the pure core does not log`);
  }

  const name = basename(file);
  if (file.endsWith(".tsx") && !/^[A-Z]/.test(name) && !/^(main|setup)\.tsx$/.test(name)) {
    problems.push(`${rel}: components are PascalCase.tsx`);
  }
}

const unexpected = observeSites.filter((file) => file !== OBSERVE_ALLOWED);
if (unexpected.length > 0) {
  problems.push(
    `observe() is owned by ${OBSERVE_ALLOWED}; also called in ${unexpected.join(", ")}`,
  );
}
if (observeSites.length === 0) {
  problems.push(`expected ${OBSERVE_ALLOWED} to own the single observe() call site`);
}

if (problems.length > 0) {
  console.error("Shape check failed:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Shape check passed across ${files.length} source files.`);

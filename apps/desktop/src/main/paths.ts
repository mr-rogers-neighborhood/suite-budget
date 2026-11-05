import { join } from "node:path";

import { suitePaths } from "@suite/contracts";
import { app } from "electron";

import type { AppPaths } from "./budgetLocation";

export type { AppPaths };

/**
 * Where this window keeps its things.
 *
 * `SUITE_BUDGET_LIBRARY` replaces the documents folder and `SUITE_BUDGET_DATA` the application
 * directory, for a test and a portable install. Neither is read from a document, so no file can steer
 * a write.
 */
export function appPaths(root?: string): AppPaths {
  const documents = suitePaths("Budget", {
    platform: process.platform,
    home: app.getPath("home"),
    documentsOverride: process.env.SUITE_BUDGET_LIBRARY,
    xdgDataHome: process.env.XDG_DATA_HOME,
  }).documents;
  const data = root?.trim() || process.env.SUITE_BUDGET_DATA?.trim() || app.getPath("userData");
  return {
    root: data,
    libraryFile: join(data, "library.json"),
    budgetsDir: documents,
    backupsDir: join(documents, ".backups"),
    recoveredDir: join(data, "recovered"),
  };
}

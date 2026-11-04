import { join } from "node:path";

import { app } from "electron";

export type AppPaths = {
  root: string;
  libraryFile: string;
  budgetsDir: string;
  backupsDir: string;
  recoveredDir: string;
};

export function appPaths(root: string = app.getPath("userData")): AppPaths {
  return {
    root,
    libraryFile: join(root, "library.json"),
    budgetsDir: join(root, "budgets"),
    backupsDir: join(root, "backups"),
    recoveredDir: join(root, "recovered"),
  };
}

export function budgetPath(paths: AppPaths, id: string): string {
  return join(paths.budgetsDir, `${id}.budget`);
}

export function backupDir(paths: AppPaths, id: string): string {
  return join(paths.backupsDir, id);
}

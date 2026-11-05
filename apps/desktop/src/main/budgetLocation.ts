import { join, sep } from "node:path";

/**
 * Where budget files live, and where the recovery copies live.
 *
 * The budgets themselves go into `~/Documents/Suite/Budget`, the folder the suite's convention gives
 * them, so a person can copy, back them up or sync the folder they already own. The daily backups sit
 * beside them under `.backups`, which is the promise that a file manager can recover a budget when the
 * app is the thing that broke.
 *
 * The library index and the recovered copies stay in the application directory: they are machine
 * state, and a synced index would describe files another machine does not have.
 *
 * Nothing here reads Electron, so the layout is a test rather than something only a window can show.
 */
export type AppPaths = {
  /** The application directory: the index and recovery copies. */
  root: string;
  libraryFile: string;
  budgetsDir: string;
  backupsDir: string;
  recoveredDir: string;
};

export function budgetPath(paths: Pick<AppPaths, "budgetsDir">, id: string): string {
  return join(paths.budgetsDir, `${id}.budget`);
}

export function backupDir(paths: AppPaths, id: string): string {
  return join(paths.backupsDir, id);
}

/** Where budgets lived before they followed the convention, for the one-time move. */
export function legacyBudgetsDir(paths: Pick<AppPaths, "root">): string {
  return join(paths.root, "budgets");
}

/** The part of `path` below `directory`, or null when it is not inside it. */
export function relativeTo(path: string, directory: string): string | null {
  const prefix = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

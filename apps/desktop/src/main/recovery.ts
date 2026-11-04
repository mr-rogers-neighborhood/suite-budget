import { cp, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { AppPaths } from "./paths";

/** Copies a damaged budget aside; it is never overwritten or repaired in place. */
export async function recoverFile(
  paths: AppPaths,
  id: string,
  sourcePath: string,
): Promise<string> {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+/, "");
  const directory = join(paths.recoveredDir, `${stamp}-${id}`);
  await mkdir(directory, { recursive: true });
  const target = join(directory, basename(sourcePath));
  await cp(sourcePath, target);
  return target;
}

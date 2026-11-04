import type { BudgetDocument, LibraryEntry } from "@suite/budget-core";

import { BudgetStore } from "./budgetStore";
import type { AppPaths } from "./paths";

let current: BudgetStore | null = null;

export function requireStore(): BudgetStore {
  if (!current) throw new Error("No budget is open");
  return current;
}

export async function openSession(
  paths: AppPaths,
  entry: LibraryEntry,
  doc: BudgetDocument,
): Promise<BudgetStore> {
  await closeSession();
  current = BudgetStore.fromDocument(paths, entry, doc);
  return current;
}

export async function closeSession(): Promise<void> {
  const store = current;
  current = null;
  if (store) await store.close();
}

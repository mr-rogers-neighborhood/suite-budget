import type { BudgetDocument, LibraryEntry } from "@suite/budget-core";
import type { AppPaths } from "./budgetLocation";
import { BudgetStore } from "./budgetStore";

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

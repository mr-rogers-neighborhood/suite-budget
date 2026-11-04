import type { LoroDoc } from "loro-crdt";

import { createId } from "../ids";
import {
  type Category,
  type CategoryGroup,
  categoryGroupSchema,
  categorySchema,
  monthlyBudgetSchema,
  targetSchema,
  transactionSchema,
} from "../schema";
import { ROOTS } from "./constants";
import { deleteRecord, getRecord, insertRecord, listRecords, updateRecord } from "./records";

export class CategoryError extends Error {
  constructor(
    readonly code: "not-found" | "not-empty",
    message: string,
  ) {
    super(message);
    this.name = "CategoryError";
  }
}

export function listCategoryGroups(doc: LoroDoc): CategoryGroup[] {
  return listRecords(doc, ROOTS.categoryGroups, categoryGroupSchema).sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name),
  );
}

export function listCategories(doc: LoroDoc): Category[] {
  return listRecords(doc, ROOTS.categories, categorySchema).sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name),
  );
}

export function getCategoryGroup(doc: LoroDoc, id: string): CategoryGroup | undefined {
  return getRecord(doc, ROOTS.categoryGroups, id, categoryGroupSchema);
}

export function getCategory(doc: LoroDoc, id: string): Category | undefined {
  return getRecord(doc, ROOTS.categories, id, categorySchema);
}

export function createCategoryGroup(
  doc: LoroDoc,
  input: { name: string; hidden?: boolean },
  now: Date = new Date(),
): CategoryGroup {
  const groups = listCategoryGroups(doc);
  const group = categoryGroupSchema.parse({
    id: createId("grp"),
    name: input.name.trim(),
    order: groups.length,
    hidden: input.hidden ?? false,
    createdAt: now.toISOString(),
  });
  insertRecord(doc, ROOTS.categoryGroups, categoryGroupSchema, group);
  return group;
}

export function updateCategoryGroup(
  doc: LoroDoc,
  id: string,
  patch: Partial<Pick<CategoryGroup, "name" | "order" | "hidden">>,
): CategoryGroup {
  return updateRecord(doc, ROOTS.categoryGroups, id, categoryGroupSchema, patch);
}

export function deleteCategoryGroup(doc: LoroDoc, id: string): void {
  const children = listCategories(doc).filter((category) => category.groupId === id);
  if (children.length > 0) {
    throw new CategoryError("not-empty", "Move or delete the categories in this group first");
  }
  deleteRecord(doc, ROOTS.categoryGroups, id);
}

export function createCategory(
  doc: LoroDoc,
  input: { groupId: string; name: string; hidden?: boolean; note?: string },
  now: Date = new Date(),
): Category {
  const siblings = listCategories(doc).filter((category) => category.groupId === input.groupId);
  const timestamp = now.toISOString();
  const category = categorySchema.parse({
    id: createId("cat"),
    groupId: input.groupId,
    name: input.name.trim(),
    order: siblings.length,
    hidden: input.hidden ?? false,
    note: input.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  insertRecord(doc, ROOTS.categories, categorySchema, category);
  return category;
}

export function updateCategory(
  doc: LoroDoc,
  id: string,
  patch: Partial<Pick<Category, "groupId" | "name" | "order" | "hidden" | "note">>,
  now: Date = new Date(),
): Category {
  return updateRecord(doc, ROOTS.categories, id, categorySchema, patch, {
    key: "updatedAt",
    value: now.toISOString(),
  });
}

export function deleteCategory(doc: LoroDoc, id: string): void {
  for (const target of listRecords(doc, ROOTS.targets, targetSchema)) {
    if (target.categoryId === id) deleteRecord(doc, ROOTS.targets, target.id);
  }
  for (const budget of listRecords(doc, ROOTS.monthlyBudgets, monthlyBudgetSchema)) {
    if (budget.categoryId === id) {
      deleteRecord(doc, ROOTS.monthlyBudgets, `${budget.month}:${budget.categoryId}`);
    }
  }
  for (const transaction of listRecords(doc, ROOTS.transactions, transactionSchema)) {
    if (transaction.categoryId === id) {
      updateRecord(doc, ROOTS.transactions, transaction.id, transactionSchema, {
        categoryId: null,
      });
    }
  }
  deleteRecord(doc, ROOTS.categories, id);
}

export function reorderCategories(
  doc: LoroDoc,
  groupId: string,
  orderedIds: readonly string[],
): void {
  orderedIds.forEach((id, index) => {
    const category = getCategory(doc, id);
    if (category && category.groupId === groupId) {
      updateRecord(doc, ROOTS.categories, id, categorySchema, { order: index });
    }
  });
}

import type { LoroDoc, LoroMap } from "loro-crdt";

import { createId } from "../ids";
import { type BudgetMeta, budgetMetaSchema, SCHEMA_VERSION } from "../schema";
import { ROOTS } from "./constants";

export function initializeMeta(
  doc: LoroDoc,
  now: Date = new Date(),
  name: string = "Budget",
): BudgetMeta {
  const map = doc.getMap(ROOTS.meta);
  if (map.get("budgetId") !== undefined) return readMeta(doc);
  const meta = budgetMetaSchema.parse({
    budgetId: createId("budget"),
    name,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
  });
  map.set("budgetId", meta.budgetId);
  map.set("name", meta.name);
  map.set("schemaVersion", meta.schemaVersion);
  map.set("createdAt", meta.createdAt);
  return meta;
}

export function readMeta(doc: LoroDoc): BudgetMeta {
  const map: LoroMap = doc.getMap(ROOTS.meta);
  return budgetMetaSchema.parse(map.toJSON());
}

export function writeMeta(doc: LoroDoc, meta: BudgetMeta): void {
  const map = doc.getMap(ROOTS.meta);
  for (const [key, value] of Object.entries(meta)) map.set(key, value);
}

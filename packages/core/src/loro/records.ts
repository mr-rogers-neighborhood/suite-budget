import type { LoroDoc } from "loro-crdt";
import type { ZodType, z } from "zod";

import { asMap, definedEntries, readRecord, writeFields } from "./helpers";

type OutputOf<S extends ZodType> = z.infer<S>;

export function listRecords<S extends ZodType>(
  doc: LoroDoc,
  root: string,
  schema: S,
): OutputOf<S>[] {
  const records: OutputOf<S>[] = [];
  for (const value of doc.getMap(root).values()) {
    const map = asMap(value);
    if (map) records.push(readRecord(schema, map) as OutputOf<S>);
  }
  return records;
}

export function getRecord<S extends ZodType>(
  doc: LoroDoc,
  root: string,
  id: string,
  schema: S,
): OutputOf<S> | undefined {
  const map = asMap(doc.getMap(root).get(id));
  return map ? (readRecord(schema, map) as OutputOf<S>) : undefined;
}

export function insertRecord<S extends ZodType<{ id: string }>>(
  doc: LoroDoc,
  root: string,
  schema: S,
  record: OutputOf<S>,
): OutputOf<S> {
  const parsed = schema.parse(record) as OutputOf<S>;
  const map = doc.getMap(root).ensureMergeableMap((parsed as { id: string }).id);
  writeFields(map, parsed as object, Object.keys(parsed as object));
  return parsed;
}

/** Inserts a record under an explicit key, for roots whose key is not the record id. */
export function putRecord<S extends ZodType>(
  doc: LoroDoc,
  root: string,
  key: string,
  schema: S,
  record: OutputOf<S>,
): OutputOf<S> {
  const parsed = schema.parse(record) as OutputOf<S>;
  const map = doc.getMap(root).ensureMergeableMap(key);
  writeFields(map, parsed as object, Object.keys(parsed as object));
  return parsed;
}

export function getByKey<S extends ZodType>(
  doc: LoroDoc,
  root: string,
  key: string,
  schema: S,
): OutputOf<S> | undefined {
  const map = asMap(doc.getMap(root).get(key));
  return map ? (readRecord(schema, map) as OutputOf<S>) : undefined;
}

export function updateRecord<S extends ZodType<{ id: string }>>(
  doc: LoroDoc,
  root: string,
  id: string,
  schema: S,
  patch: Partial<OutputOf<S>>,
  touch: { key: string; value: string } | null = null,
): OutputOf<S> {
  const current = getRecord(doc, root, id, schema);
  if (!current) throw new Error(`${root} record ${id} does not exist`);
  const changes = Object.fromEntries(definedEntries(patch)) as Partial<OutputOf<S>>;
  const next = schema.parse({
    ...current,
    ...changes,
    ...(touch ? { [touch.key]: touch.value } : {}),
  }) as OutputOf<S>;
  const map = asMap(doc.getMap(root).get(id));
  if (!map) throw new Error(`${root} record ${id} does not exist`);
  const keys = [...Object.keys(changes as object), ...(touch ? [touch.key] : [])];
  writeFields(map, next as object, keys);
  return next;
}

export function deleteRecord(doc: LoroDoc, root: string, id: string): void {
  doc.getMap(root).delete(id);
}

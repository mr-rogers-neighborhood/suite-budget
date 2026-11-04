import { LoroMap } from "loro-crdt";
import type { ZodType } from "zod";

export function asMap(value: unknown): LoroMap | undefined {
  return value instanceof LoroMap ? value : undefined;
}

export function readRecord<T>(schema: ZodType<T>, map: LoroMap): T {
  return schema.parse(map.toJSON());
}

export function writeFields(map: LoroMap, record: object, keys: readonly string[]): void {
  const values = record as Record<string, unknown>;
  for (const key of keys) {
    const value = values[key];
    if (value === undefined) continue;
    map.set(key, value);
  }
}

export function definedEntries<T extends object>(value: T): [string, unknown][] {
  return Object.entries(value).filter(([, entry]) => entry !== undefined);
}

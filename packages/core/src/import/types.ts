import type { DateKey } from "../dates";
import type { ClearedStatus } from "../schema";

export type ImportedSplit = {
  categoryName: string | null;
  amountMinor: number;
  memo: string;
};

export type ImportRow = {
  date: DateKey;
  amountMinor: number;
  payeeName: string;
  memo: string;
  categoryName: string | null;
  cleared: ClearedStatus;
  externalId: string | null;
  transferAccountName: string | null;
  splits: ImportedSplit[];
};

export type ImportMessage = {
  row: number;
  message: string;
};

export type ImportBatch = {
  rows: ImportRow[];
  errors: ImportMessage[];
  warnings: ImportMessage[];
};

export type ImportFailureCode = "empty" | "no-columns" | "unreadable";

export class ImportError extends Error {
  constructor(
    readonly code: ImportFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export type DateFormat = "iso" | "us" | "eu";

export function emptyBatch(): ImportBatch {
  return { rows: [], errors: [], warnings: [] };
}

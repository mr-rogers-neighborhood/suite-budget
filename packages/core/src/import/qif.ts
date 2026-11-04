import { err, ok, type Result } from "neverthrow";

import { parseMoney } from "../money";
import { parseDateCell } from "./csv";
import {
  type DateFormat,
  type ImportBatch,
  ImportError,
  type ImportedSplit,
  type ImportRow,
} from "./types";

export type QifOptions = {
  dateFormat: DateFormat;
};

type QifRecord = {
  date: string;
  amount: string;
  payee: string;
  memo: string;
  category: string;
  cleared: string;
  number: string;
  splits: { category: string; memo: string; amount: string }[];
};

const TRANSACTION_TYPES = new Set(["bank", "cash", "ccard", "oth a", "oth l"]);

export function parseQif(
  text: string,
  currency: string,
  scale: number,
  options: QifOptions,
): Result<ImportBatch, ImportError> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const batch: ImportBatch = { rows: [], errors: [], warnings: [] };
  let active = true;
  let current: QifRecord = blankRecord();
  let recordNumber = 0;

  const flush = (): void => {
    if (
      current.date.length === 0 &&
      current.amount.length === 0 &&
      current.payee.length === 0 &&
      current.splits.length === 0
    ) {
      current = blankRecord();
      return;
    }
    recordNumber += 1;
    const date = parseDateCell(current.date, options.dateFormat);
    if (!date) {
      batch.errors.push({
        row: recordNumber,
        message: `Could not read the date "${current.date}"`,
      });
      current = blankRecord();
      return;
    }

    const splits: ImportedSplit[] = [];
    for (const split of current.splits) {
      const parsed = parseMoney(split.amount, currency, scale);
      if (parsed.isErr() || parsed.value === 0) {
        batch.warnings.push({
          row: recordNumber,
          message: `Skipped a split line "${split.category}" with an unreadable amount`,
        });
        continue;
      }
      splits.push({
        categoryName: split.category.trim() || null,
        amountMinor: parsed.value,
        memo: split.memo,
      });
    }

    let amount: number | null = null;
    if (current.amount.length > 0) {
      const parsed = parseMoney(current.amount, currency, scale);
      if (parsed.isOk()) amount = parsed.value;
    }
    if (amount === null && splits.length > 0) {
      amount = splits.reduce((sum, split) => sum + split.amountMinor, 0);
    }
    if (amount === null || amount === 0) {
      batch.errors.push({ row: recordNumber, message: "Could not read the amount" });
      current = blankRecord();
      return;
    }

    const transfer = /^\[(.+)]$/.exec(current.category.trim());
    const row: ImportRow = {
      date,
      amountMinor: amount,
      payeeName: current.payee.trim(),
      memo: current.memo.trim(),
      categoryName: transfer ? null : current.category.trim() || null,
      cleared: readCleared(current.cleared),
      externalId: current.number.trim() || null,
      transferAccountName: transfer?.[1]?.trim() ?? null,
      splits,
    };
    batch.rows.push(row);
    current = blankRecord();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.length === 0) continue;
    if (line.startsWith("!")) {
      flush();
      const type = line.slice(1).toLowerCase();
      if (type.startsWith("type:")) active = TRANSACTION_TYPES.has(type.slice(5).trim());
      else active = false;
      continue;
    }
    if (!active) continue;
    if (line === "^") {
      flush();
      continue;
    }
    const code = line.charAt(0);
    const value = line.slice(1);
    if (code === "D") current.date = value;
    else if (code === "T") current.amount = value;
    else if (code === "P") current.payee = value;
    else if (code === "M") current.memo = value;
    else if (code === "L") current.category = value;
    else if (code === "C") current.cleared = value;
    else if (code === "N") current.number = value;
    else if (code === "S") current.splits.push({ category: value, memo: "", amount: "" });
    else if (code === "E") {
      const split = current.splits[current.splits.length - 1];
      if (split) split.memo = value;
    } else if (code === "$") {
      const split = current.splits[current.splits.length - 1];
      if (split) split.amount = value;
    }
  }
  flush();

  if (batch.rows.length === 0 && batch.errors.length === 0) {
    return err(new ImportError("empty", "No QIF transactions were found"));
  }
  return ok(batch);
}

function blankRecord(): QifRecord {
  return {
    date: "",
    amount: "",
    payee: "",
    memo: "",
    category: "",
    cleared: "",
    number: "",
    splits: [],
  };
}

function readCleared(value: string): "uncleared" | "cleared" | "reconciled" {
  if (value === "R" || value === "r") return "reconciled";
  if (value === "C" || value === "c" || value === "*") return "cleared";
  return "uncleared";
}

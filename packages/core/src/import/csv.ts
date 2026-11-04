import { err, ok, type Result } from "neverthrow";

import { dateKey, isDateKey } from "../dates";
import { parseMoney } from "../money";
import { type DateFormat, type ImportBatch, ImportError, type ImportRow } from "./types";

export type CsvMapping = {
  delimiter: string;
  hasHeader: boolean;
  skipRows: number;
  dateColumn: number;
  dateFormat: DateFormat;
  payeeColumn: number;
  memoColumn: number | null;
  amountColumn: number | null;
  inflowColumn: number | null;
  outflowColumn: number | null;
  categoryColumn: number | null;
  negate: boolean;
};

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(
  text: string,
  mapping: CsvMapping,
  currency: string,
  scale: number,
): Result<ImportBatch, ImportError> {
  const rows = parseCsvRows(text, mapping.delimiter);
  if (rows.length === 0) {
    return err(new ImportError("empty", "The file is empty"));
  }
  if (
    mapping.amountColumn === null &&
    (mapping.inflowColumn === null || mapping.outflowColumn === null)
  ) {
    return err(
      new ImportError(
        "no-columns",
        "Choose an amount column, or both an inflow and an outflow column",
      ),
    );
  }

  const batch: ImportBatch = { rows: [], errors: [], warnings: [] };
  const headerOffset = mapping.hasHeader ? 1 : 0;
  for (let index = mapping.skipRows + headerOffset; index < rows.length; index += 1) {
    const cells = rows[index];
    if (!cells || cells.every((cell) => cell.trim().length === 0)) continue;
    const line = index + 1;

    const date = parseDateCell(cells[mapping.dateColumn], mapping.dateFormat);
    if (!date) {
      batch.errors.push({
        row: line,
        message: `Could not read the date "${cells[mapping.dateColumn] ?? ""}"`,
      });
      continue;
    }

    const amount = readAmount(cells, mapping, currency, scale);
    if (amount === null) {
      batch.errors.push({ row: line, message: "Could not read the amount" });
      continue;
    }

    const row: ImportRow = {
      date,
      amountMinor: amount,
      payeeName: (cells[mapping.payeeColumn] ?? "").trim(),
      memo: mapping.memoColumn === null ? "" : (cells[mapping.memoColumn] ?? "").trim(),
      categoryName:
        mapping.categoryColumn === null
          ? null
          : (cells[mapping.categoryColumn] ?? "").trim() || null,
      cleared: "uncleared",
      externalId: null,
      transferAccountName: null,
      splits: [],
    };
    batch.rows.push(row);
  }

  if (batch.rows.length === 0 && batch.errors.length === 0) {
    return err(new ImportError("empty", "No rows could be read"));
  }
  return ok(batch);
}

function readAmount(
  cells: readonly string[],
  mapping: CsvMapping,
  currency: string,
  scale: number,
): number | null {
  if (mapping.amountColumn !== null) {
    const parsed = parseMoney(cells[mapping.amountColumn] ?? "", currency, scale);
    if (parsed.isErr()) return null;
    return mapping.negate ? -parsed.value : parsed.value;
  }
  const inflow =
    mapping.inflowColumn === null
      ? null
      : parseMoney(cells[mapping.inflowColumn] ?? "", currency, scale);
  const outflow =
    mapping.outflowColumn === null
      ? null
      : parseMoney(cells[mapping.outflowColumn] ?? "", currency, scale);
  if ((!inflow || inflow.isErr()) && (!outflow || outflow.isErr())) return null;
  const inflowMinor = inflow?.isOk() ? Math.abs(inflow.value) : 0;
  const outflowMinor = outflow?.isOk() ? Math.abs(outflow.value) : 0;
  const amount = inflowMinor - outflowMinor;
  return mapping.negate ? -amount : amount;
}

export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function parseDateCell(value: string | undefined, format: DateFormat): string | null {
  const text = (value ?? "").trim();
  if (text.length === 0) return null;
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (iso) {
    const key = dateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return isDateKey(key) ? key : null;
  }
  const short = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (short) {
    const first = Number(short[1]);
    const second = Number(short[2]);
    const rawYear = Number(short[3]);
    const year = rawYear < 100 ? (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
    const month = format === "eu" ? second : first;
    const day = format === "eu" ? first : second;
    const key = dateKey(year, month, day);
    return isDateKey(key) ? key : null;
  }
  return null;
}

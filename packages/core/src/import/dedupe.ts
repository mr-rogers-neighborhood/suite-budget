import { diffDays } from "../dates";
import type { Transaction } from "../schema";
import type { ImportRow } from "./types";

export type DuplicateCandidate = {
  transactionId: string;
  score: number;
  reasons: string[];
};

export type DedupeOptions = {
  dateWindowDays?: number;
  minimumScore?: number;
};

export function findDuplicateCandidates(
  existing: readonly Transaction[],
  row: ImportRow,
  accountId: string,
  options: DedupeOptions = {},
): DuplicateCandidate[] {
  const window = options.dateWindowDays ?? 3;
  const minimum = options.minimumScore ?? 0.6;
  const candidates: DuplicateCandidate[] = [];

  for (const transaction of existing) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.parentId !== null) continue;
    if (transaction.amountMinor !== row.amountMinor) continue;

    const reasons: string[] = ["same amount"];
    const days = Math.abs(diffDays(transaction.date, row.date));
    if (days > window) continue;
    reasons.push(days === 0 ? "same date" : `${days} day${days === 1 ? "" : "s"} apart`);

    const left = normalizePayee(transaction.payeeName);
    const right = normalizePayee(row.payeeName);
    let payeeScore = 0;
    if (left.length > 0 && right.length > 0) {
      if (left === right) {
        payeeScore = 1;
        reasons.push("same payee");
      } else {
        payeeScore = tokenSimilarity(left, right);
        if (payeeScore > 0.5) reasons.push("similar payee");
      }
    }

    const dateScore = days === 0 ? 1 : 1 - days / (window + 1);
    const score = 0.45 * dateScore + 0.4 * payeeScore + 0.15;
    if (score >= minimum) {
      candidates.push({ transactionId: transaction.id, score, reasons });
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function normalizePayee(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

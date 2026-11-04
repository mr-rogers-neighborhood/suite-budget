import { compareMonths, type MonthKey, monthsRemaining } from "../dates";
import type { Target } from "../schema";

export function pickActiveTarget(
  targets: readonly Target[],
  categoryId: string,
  month: MonthKey,
): Target | undefined {
  let match: Target | undefined;
  for (const target of targets) {
    if (target.categoryId !== categoryId) continue;
    const started = compareMonths(target.startsOn, month) <= 0;
    const notEnded = target.endsOn === null || compareMonths(month, target.endsOn) <= 0;
    if (!started || !notEnded) continue;
    if (!match || compareMonths(target.startsOn, match.startsOn) > 0) match = target;
  }
  return match;
}

export type TargetStatus = {
  target: Target;
  suggestionMinor: number;
  funded: boolean;
  progress: number;
  remainingMinor: number;
  monthsLeft: number;
};

export function ceilDivide(value: number, divisor: number): number {
  if (divisor <= 0) return Math.max(0, value);
  return Math.max(0, Math.ceil(value / divisor));
}

export function targetStatus(
  target: Target,
  availableMinor: number,
  month: MonthKey,
  linkedBalanceMinor: number | null = null,
  originalDebtMinor: number | null = null,
): TargetStatus {
  if (target.kind === "monthly") {
    const remaining = Math.max(0, target.amountMinor - availableMinor);
    return {
      target,
      suggestionMinor: remaining,
      funded: availableMinor >= target.amountMinor,
      progress: clamp01(target.amountMinor === 0 ? 1 : availableMinor / target.amountMinor),
      remainingMinor: remaining,
      monthsLeft: 1,
    };
  }

  if (target.kind === "debt_payoff") {
    const debt = linkedBalanceMinor === null ? 0 : Math.max(0, -linkedBalanceMinor);
    const monthsLeft = target.dueMonth ? monthsRemaining(month, target.dueMonth) : 1;
    const progress =
      debt <= 0
        ? 1
        : originalDebtMinor && originalDebtMinor > 0
          ? clamp01(1 - debt / originalDebtMinor)
          : 0;
    return {
      target,
      suggestionMinor: ceilDivide(debt, monthsLeft),
      funded: debt <= 0,
      progress,
      remainingMinor: debt,
      monthsLeft,
    };
  }

  const monthsLeft = target.dueMonth ? monthsRemaining(month, target.dueMonth) : 1;
  const remaining = Math.max(0, target.amountMinor - availableMinor);
  return {
    target,
    suggestionMinor: ceilDivide(remaining, monthsLeft),
    funded: availableMinor >= target.amountMinor,
    progress: clamp01(target.amountMinor === 0 ? 1 : availableMinor / target.amountMinor),
    remainingMinor: remaining,
    monthsLeft,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

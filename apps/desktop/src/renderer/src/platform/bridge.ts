import type { BudgetBridge } from "@suite/budget-core";

export function getBridge(): BudgetBridge {
  const bridge = window.suiteBudget;
  if (!bridge) throw new Error("Suite Budget must run inside its desktop shell");
  return bridge;
}

import type { BudgetBridge } from "@suite/budget-core";

declare global {
  interface Window {
    suiteBudget?: BudgetBridge;
  }
}

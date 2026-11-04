import { type MonthKey, monthKeyOfDate } from "@suite/budget-core";
import { create } from "zustand";

export type View = "plan" | "accounts" | "reports" | "rules" | "schedules" | "payees";

type Notice = {
  message: string;
  tone: "info" | "error";
};

type UiState = {
  view: View;
  month: MonthKey;
  selectedAccountId: string | null;
  selectedTransactionId: string | null;
  notice: Notice | null;
  paletteOpen: boolean;
  newTransactionOpen: boolean;
  reconcileOpen: boolean;
  importOpen: boolean;
  newBudgetOpen: boolean;
  accountDialogOpen: boolean;
  editingAccountId: string | null;
  targetCategoryId: string | null;
  moveMoneyOpen: boolean;
  setView: (view: View) => void;
  setMonth: (month: MonthKey) => void;
  selectAccount: (id: string | null) => void;
  selectTransaction: (id: string | null) => void;
  setNotice: (message: string, tone?: Notice["tone"]) => void;
  clearNotice: () => void;
  setPaletteOpen: (open: boolean) => void;
  setNewTransactionOpen: (open: boolean) => void;
  setReconcileOpen: (open: boolean) => void;
  setImportOpen: (open: boolean) => void;
  setNewBudgetOpen: (open: boolean) => void;
  setAccountDialog: (open: boolean, id?: string | null) => void;
  setTargetCategory: (id: string | null) => void;
  setMoveMoneyOpen: (open: boolean) => void;
  resetForBudget: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  view: "plan",
  month: monthKeyOfDate(new Date()),
  selectedAccountId: null,
  selectedTransactionId: null,
  notice: null,
  paletteOpen: false,
  newTransactionOpen: false,
  reconcileOpen: false,
  importOpen: false,
  newBudgetOpen: false,
  accountDialogOpen: false,
  editingAccountId: null,
  targetCategoryId: null,
  moveMoneyOpen: false,
  setView: (view) => set({ view }),
  setMonth: (month) => set({ month }),
  selectAccount: (selectedAccountId) => set({ selectedAccountId, view: "accounts" }),
  selectTransaction: (selectedTransactionId) => set({ selectedTransactionId }),
  setNotice: (message, tone = "info") => set({ notice: { message, tone } }),
  clearNotice: () => set({ notice: null }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setNewTransactionOpen: (newTransactionOpen) => set({ newTransactionOpen }),
  setReconcileOpen: (reconcileOpen) => set({ reconcileOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setNewBudgetOpen: (newBudgetOpen) => set({ newBudgetOpen }),
  setAccountDialog: (accountDialogOpen, editingAccountId = null) =>
    set({ accountDialogOpen, editingAccountId }),
  setTargetCategory: (targetCategoryId) => set({ targetCategoryId }),
  setMoveMoneyOpen: (moveMoneyOpen) => set({ moveMoneyOpen }),
  resetForBudget: () =>
    set({
      view: "plan",
      month: monthKeyOfDate(new Date()),
      selectedAccountId: null,
      selectedTransactionId: null,
      notice: null,
      paletteOpen: false,
      newTransactionOpen: false,
      reconcileOpen: false,
      importOpen: false,
      accountDialogOpen: false,
      editingAccountId: null,
      targetCategoryId: null,
      moveMoneyOpen: false,
    }),
}));

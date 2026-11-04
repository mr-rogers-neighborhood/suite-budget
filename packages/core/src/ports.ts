import type { AccountType } from "./schema";

export type LibraryEntry = {
  id: string;
  name: string;
  path: string;
  currency: string;
  createdAt: string;
  lastOpenedAt: string;
};

export type StarterTemplateId = "essentials" | "four_rules" | "blank";

export type StartingAccountInput = {
  name: string;
  type: AccountType;
  onBudget?: boolean | undefined;
  startingBalanceMinor: number;
};

export type CreateBudgetInput = {
  name: string;
  currency: string;
  currencyScale?: number | undefined;
  firstDayOfWeek?: number | undefined;
  template: StarterTemplateId;
  startingAccount?: StartingAccountInput | undefined;
};

export type OpenBudgetInfo = {
  entry: LibraryEntry;
  snapshot: Uint8Array;
  warning?: string;
};

export type ImportBudgetResult = {
  canceled: boolean;
  opened?: OpenBudgetInfo;
};

export type ImportReadResult = {
  canceled: boolean;
  name?: string;
  text?: string;
};

export type FileResult = {
  canceled: boolean;
  path?: string;
};

export type BudgetInfo = {
  id: string;
  name: string;
  path: string;
  schemaVersion: number;
  currency: string;
  currencyScale: number;
  saveError?: string | null;
};

export type ExportFormat = "json" | "csv" | "qif";

export type AppCommand =
  | "new-budget"
  | "open-file"
  | "show-budgets"
  | "save-copy"
  | "export-budget"
  | "export-json"
  | "export-csv"
  | "export-qif"
  | "close-budget"
  | "undo"
  | "redo"
  | "view-plan"
  | "view-accounts"
  | "view-reports"
  | "new-transaction"
  | "command-palette";

export type BudgetBridge = {
  listBudgets(): Promise<LibraryEntry[]>;
  createBudget(input: CreateBudgetInput): Promise<OpenBudgetInfo>;
  openBudget(id: string): Promise<OpenBudgetInfo>;
  closeBudget(): Promise<void>;
  removeBudget(id: string): Promise<void>;
  revealBudget(id: string): Promise<void>;
  renameBudget(id: string, name: string): Promise<LibraryEntry>;
  importBudget(): Promise<ImportBudgetResult>;
  openBudgetFile(): Promise<ImportBudgetResult>;
  readImportSource(): Promise<ImportReadResult>;
  loadSnapshot(): Promise<Uint8Array>;
  commit(update: Uint8Array): Promise<void>;
  info(): Promise<BudgetInfo>;
  exportBudget(): Promise<FileResult>;
  exportRecords(format: ExportFormat): Promise<FileResult>;
  onBudgetReplaced(listener: (snapshot: Uint8Array) => void): () => void;
  onBudgetOpened(listener: (info: OpenBudgetInfo) => void): () => void;
  onCommand(listener: (command: AppCommand) => void): () => void;
  platform(): Promise<string>;
};

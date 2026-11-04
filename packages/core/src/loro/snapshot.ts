import type { LoroDoc } from "loro-crdt";

import type { BudgetSnapshot } from "../schema";
import { listAccounts } from "./accounts";
import { listCategories, listCategoryGroups } from "./categories";
import { listDashboards, listWidgets } from "./dashboards";
import { readMeta } from "./meta";
import { listMonthlyBudgets } from "./months";
import { listPayees } from "./payees";
import { listReconciliations } from "./reconciliations";
import { listRules } from "./rules";
import { listSchedules } from "./schedules";
import { readSettings } from "./settings";
import { listTargets } from "./targets";
import { listTransactions } from "./transactions";

export function readBudgetSnapshot(doc: LoroDoc): BudgetSnapshot {
  return {
    meta: readMeta(doc),
    settings: readSettings(doc),
    accounts: listAccounts(doc),
    categoryGroups: listCategoryGroups(doc),
    categories: listCategories(doc),
    targets: listTargets(doc),
    monthlyBudgets: listMonthlyBudgets(doc),
    transactions: listTransactions(doc),
    payees: listPayees(doc),
    rules: listRules(doc),
    schedules: listSchedules(doc),
    reconciliations: listReconciliations(doc),
    dashboards: listDashboards(doc),
    widgets: listWidgets(doc),
  };
}

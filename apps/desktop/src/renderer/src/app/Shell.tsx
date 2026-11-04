import { Command, Plus, Redo2, Undo2, Upload } from "lucide-react";

import { AccountDialog } from "../accounts/AccountDialog";
import { AccountsView } from "../accounts/AccountsView";
import { ReconcileDialog } from "../accounts/ReconcileDialog";
import { TransactionDialog } from "../accounts/TransactionDialog";
import { CommandPalette } from "../command/CommandPalette";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ImportWizard } from "../import/ImportWizard";
import { PayeesView } from "../payees/PayeesView";
import { MoveMoneyDialog } from "../plan/MoveMoneyDialog";
import { PlanView } from "../plan/PlanView";
import { TargetDialog } from "../plan/TargetDialog";
import { ReportsView } from "../reports/ReportsView";
import { RulesView } from "../rules/RulesView";
import { SchedulesView } from "../schedules/SchedulesView";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore, type View } from "../store/uiStore";
import { Sidebar } from "./Sidebar";

const TITLES: Record<View, string> = {
  plan: "Plan",
  accounts: "Accounts",
  reports: "Reports",
  rules: "Rules",
  schedules: "Schedules",
  payees: "Payees",
};

export function Shell({
  onCloseBudget,
  onExportBudget,
  onExportRecords,
}: {
  onCloseBudget: () => void;
  onExportBudget: () => void;
  onExportRecords: (format: "json" | "csv" | "qif") => void;
}) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const view = useUiStore((state) => state.view);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setImportOpen = useUiStore((state) => state.setImportOpen);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const selectTransaction = useUiStore((state) => state.selectTransaction);
  const setView = useUiStore((state) => state.setView);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar
        onCloseBudget={onCloseBudget}
        onExportBudget={onExportBudget}
        onExportRecords={onExportRecords}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
          <span className="max-w-64 truncate text-[12px] text-muted">{snapshot.meta.name}</span>
          <span className="text-faint">/</span>
          <span className="text-[12px] font-medium text-ink">{TITLES[view]}</span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              label="Undo"
              icon={<Undo2 size={15} />}
              onClick={() => replica.undo()}
              disabled={!replica.canUndo()}
            />
            <IconButton
              label="Redo"
              icon={<Redo2 size={15} />}
              onClick={() => replica.redo()}
              disabled={!replica.canRedo()}
            />
            <Button size="sm" variant="ghost" onClick={() => setPaletteOpen(true)}>
              <Command size={13} />
              Search
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>
              <Upload size={13} />
              Import
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const account =
                  snapshot.accounts.find(
                    (candidate) => candidate.onBudget && !candidate.closedAt,
                  ) ?? snapshot.accounts[0];
                if (account) {
                  useUiStore.getState().selectAccount(account.id);
                } else {
                  setView("accounts");
                }
                selectTransaction(null);
                setNewTransactionOpen(true);
              }}
            >
              <Plus size={13} />
              Add transaction
            </Button>
          </div>
        </header>

        <main className="scroll min-h-0 flex-1 overflow-y-auto">
          {view === "plan" ? <PlanView /> : null}
          {view === "accounts" ? <AccountsView /> : null}
          {view === "reports" ? <ReportsView /> : null}
          {view === "rules" ? <RulesView /> : null}
          {view === "schedules" ? <SchedulesView /> : null}
          {view === "payees" ? <PayeesView /> : null}
        </main>
      </div>

      <AccountDialog />
      <TransactionDialog />
      <ReconcileDialog />
      <TargetDialog />
      <MoveMoneyDialog />
      <ImportWizard />
      <CommandPalette onCloseBudget={onCloseBudget} />
    </div>
  );
}

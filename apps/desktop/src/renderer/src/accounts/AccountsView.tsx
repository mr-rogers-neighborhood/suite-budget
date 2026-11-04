import { type Account, formatMoney } from "@suite/budget-core";
import { CircleDollarSign, Pencil, Plus, Scale, Wallet } from "lucide-react";

import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";
import { Register } from "./Register";

export function AccountsView() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const selectAccount = useUiStore((state) => state.selectAccount);
  const setAccountDialog = useUiStore((state) => state.setAccountDialog);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const setReconcileOpen = useUiStore((state) => state.setReconcileOpen);
  const account = snapshot.accounts.find((candidate) => candidate.id === selectedAccountId);

  const money = (value: number) =>
    formatMoney(value, snapshot.settings.currency, undefined, snapshot.settings.currencyScale);

  if (!account) {
    return (
      <div className="p-6">
        {snapshot.accounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            body="Add the accounts your money lives in. A starting balance becomes the first transaction."
            action={
              <Button variant="primary" onClick={() => setAccountDialog(true)}>
                <Plus size={14} />
                Add an account
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-[15px] font-semibold text-ink">Accounts</h1>
              <Button size="sm" onClick={() => setAccountDialog(true)}>
                <Plus size={13} />
                Add account
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.accounts.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectAccount(candidate.id)}
                  className="rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-faint"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">{candidate.name}</p>
                      <p className="mt-0.5 text-[11px] text-faint">
                        {labelForType(candidate.type)} ·{" "}
                        {candidate.onBudget ? "on budget" : "off budget"}
                        {candidate.closedAt ? " · closed" : ""}
                      </p>
                    </div>
                    <Wallet size={16} className="text-faint" />
                  </div>
                  <p
                    className={`tnum mt-4 text-[20px] font-semibold ${
                      replica.document.accountBalance(candidate.id) < 0
                        ? "text-negative"
                        : "text-ink"
                    }`}
                  >
                    {money(replica.document.accountBalance(candidate.id))}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const balance = replica.document.accountBalance(account.id);
  const cleared = replica.document.clearedBalance(account.id, "9999-12-31");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[16px] font-semibold text-ink">{account.name}</h1>
            {account.closedAt ? (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-faint">
                Closed
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-faint">
            {labelForType(account.type)} · {account.onBudget ? "On budget" : "Off budget"} · cleared
            balance {money(cleared)}
          </p>
        </div>
        <p
          className={`tnum ml-auto text-[22px] font-semibold ${
            balance < 0 ? "text-negative" : "text-ink"
          }`}
        >
          {money(balance)}
        </p>
      </header>

      <div className="flex items-center gap-2 border-b border-line px-6 py-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            useUiStore.getState().selectTransaction(null);
            setNewTransactionOpen(true);
          }}
          disabled={Boolean(account.closedAt)}
        >
          <Plus size={13} />
          Add transaction
        </Button>
        <Button
          size="sm"
          onClick={() => setReconcileOpen(true)}
          disabled={Boolean(account.closedAt)}
        >
          <Scale size={13} />
          Reconcile
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAccountDialog(true, account.id)}>
          <Pencil size={13} />
          Edit account
        </Button>
        <p className="ml-auto flex items-center gap-1.5 text-[11px] text-faint">
          <CircleDollarSign size={13} />
          {account.onBudget ? "Counts toward Ready to Assign" : "Net worth only"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Register account={account} />
      </div>
    </div>
  );
}

function labelForType(type: Account["type"]): string {
  if (type === "checking") return "Checking";
  if (type === "savings") return "Savings";
  if (type === "cash") return "Cash";
  if (type === "credit") return "Credit card";
  return "Loan";
}

import { type Account, formatMoney, partsOfDateKey, type Transaction } from "@suite/budget-core";
import { CheckCircle2, ChevronRight, Lock, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function Register({ account }: { account: Account }) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const openTransaction = (id: string) => {
    useUiStore.getState().selectTransaction(id);
    useUiStore.getState().setNewTransactionOpen(true);
  };
  const setNotice = useUiStore((state) => state.setNotice);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const categoryName = (id: string | null) =>
    id === "rta"
      ? "Ready to Assign"
      : (snapshot.categories.find((category) => category.id === id)?.name ?? "Uncategorized");

  const transactions = replica.document.listTransactions(account.id);
  const ascending = [...transactions].sort((left, right) =>
    left.date === right.date
      ? left.createdAt.localeCompare(right.createdAt)
      : left.date.localeCompare(right.date),
  );
  const childrenByParent = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!transaction.parentId) continue;
    const children = childrenByParent.get(transaction.parentId) ?? [];
    children.push(transaction);
    childrenByParent.set(transaction.parentId, children);
  }

  const balanceAfter = new Map<string, number>();
  let running = 0;
  for (const transaction of ascending) {
    if (transaction.parentId !== null) continue;
    running += transaction.amountMinor;
    balanceAfter.set(transaction.id, running);
    for (const child of childrenByParent.get(transaction.id) ?? []) {
      balanceAfter.set(child.id, running);
    }
  }

  const visible = transactions
    .filter((transaction) => transaction.parentId === null)
    .filter((transaction) => {
      if (search.trim().length === 0) return true;
      const needle = search.toLowerCase();
      return (
        transaction.payeeName.toLowerCase().includes(needle) ||
        transaction.memo.toLowerCase().includes(needle) ||
        categoryName(transaction.categoryId).toLowerCase().includes(needle)
      );
    })
    .sort((left, right) =>
      left.date === right.date
        ? right.createdAt.localeCompare(left.createdAt)
        : right.date.localeCompare(left.date),
    );

  const cleared = replica.document.clearedBalance(account.id, "9999-12-31");

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 px-6 py-2">
        <div className="relative w-64">
          <Search size={13} className="absolute left-2.5 top-2 text-faint" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this account"
            aria-label="Search this account"
            className="h-7 w-full rounded-md border border-line bg-raised pl-7 pr-2 text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <p className="ml-auto text-[11px] text-faint">
          {visible.length} transaction{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-[96px_minmax(150px,1.4fr)_minmax(120px,1fr)_minmax(100px,1fr)_110px_110px_110px_64px] border-y border-line bg-panel/60 px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
        <span>Date</span>
        <span>Payee</span>
        <span>Category</span>
        <span>Memo</span>
        <span className="text-right">Outflow</span>
        <span className="text-right">Inflow</span>
        <span className="text-right">Balance</span>
        <span className="text-right">Cleared</span>
      </div>

      {visible.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={search ? "Nothing matches" : "No transactions yet"}
            body={
              search
                ? "Try a different payee, category, or memo."
                : "Add a transaction, import a CSV, or enter a transfer."
            }
            action={
              <Button
                variant="primary"
                onClick={() => {
                  useUiStore.getState().selectTransaction(null);
                  useUiStore.getState().setNewTransactionOpen(true);
                }}
              >
                <Plus size={14} />
                Add transaction
              </Button>
            }
          />
        </div>
      ) : (
        visible.map((transaction) => {
          const children = childrenByParent.get(transaction.id) ?? [];
          const isExpanded = expanded.has(transaction.id);
          return (
            <div key={transaction.id}>
              <Row
                transaction={transaction}
                category={
                  children.length > 0
                    ? `Split (${children.length})`
                    : categoryName(transaction.categoryId)
                }
                balance={balanceAfter.get(transaction.id) ?? 0}
                money={money}
                expanded={children.length > 0 ? isExpanded : undefined}
                onToggleExpand={
                  children.length > 0
                    ? () => {
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(transaction.id)) next.delete(transaction.id);
                          else next.add(transaction.id);
                          return next;
                        });
                      }
                    : undefined
                }
                onClick={() => openTransaction(transaction.id)}
                onToggleCleared={() => {
                  try {
                    replica.document.toggleCleared(transaction.id);
                  } catch (error) {
                    setNotice(error instanceof Error ? error.message : "Could not update", "error");
                  }
                }}
              />
              {isExpanded
                ? children.map((child) => (
                    <Row
                      key={child.id}
                      transaction={child}
                      category={categoryName(child.categoryId)}
                      balance={balanceAfter.get(child.id) ?? 0}
                      money={money}
                      child
                      onClick={() => openTransaction(child.id)}
                      onToggleCleared={() => {
                        try {
                          replica.document.toggleCleared(child.id);
                        } catch (error) {
                          setNotice(
                            error instanceof Error ? error.message : "Could not update",
                            "error",
                          );
                        }
                      }}
                    />
                  ))
                : null}
            </div>
          );
        })
      )}

      <div className="flex items-center gap-6 border-t border-line px-6 py-2 text-[11px] text-faint">
        <span>
          Cleared <span className="tnum text-muted">{money(cleared)}</span>
        </span>
        <span>
          Working <span className="tnum text-muted">{money(running)}</span>
        </span>
        <span className="ml-auto">
          Reconciled rows are read-only until the reconciliation is unlocked.
        </span>
      </div>
    </div>
  );
}

function shortDate(value: string): string {
  const { year, month, day } = partsOfDateKey(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
}

function Row({
  transaction,
  category,
  balance,
  money,
  child = false,
  expanded,
  onToggleExpand,
  onClick,
  onToggleCleared,
}: {
  transaction: Transaction;
  category: string;
  balance: number;
  money: (value: number) => string;
  child?: boolean;
  expanded?: boolean | undefined;
  onToggleExpand?: (() => void) | undefined;
  onClick: () => void;
  onToggleCleared: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a register row is a container for its own controls
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`grid cursor-default grid-cols-[96px_minmax(150px,1.4fr)_minmax(120px,1fr)_minmax(100px,1fr)_110px_110px_110px_64px] items-center border-b border-line/50 px-6 py-1 text-[12px] hover:bg-raised/50 ${
        child ? "bg-panel/30" : ""
      }`}
    >
      <span className="text-faint">{shortDate(transaction.date)}</span>
      <span className={`flex min-w-0 items-center gap-1 ${child ? "pl-4" : ""}`}>
        {onToggleExpand ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse split" : "Expand split"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand();
            }}
            className="text-faint hover:text-ink"
          >
            <ChevronRight size={12} className={expanded ? "rotate-90" : ""} />
          </button>
        ) : null}
        <span className="truncate text-ink">{transaction.payeeName || "—"}</span>
        {transaction.flag ? (
          <span
            role="img"
            aria-label={`Flagged ${transaction.flag}`}
            title={`Flagged ${transaction.flag}`}
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--flag-${transaction.flag}, var(--accent))` }}
          />
        ) : null}
      </span>
      <span className="truncate text-muted">{category}</span>
      <span className="truncate text-faint">{transaction.memo}</span>
      <span className="tnum text-right text-muted">
        {transaction.amountMinor < 0 ? money(-transaction.amountMinor) : ""}
      </span>
      <span className="tnum text-right text-positive">
        {transaction.amountMinor > 0 ? money(transaction.amountMinor) : ""}
      </span>
      <span className="tnum text-right text-faint">{money(balance)}</span>
      <span className="flex justify-end">
        <button
          type="button"
          aria-label={
            transaction.cleared === "reconciled"
              ? "Reconciled"
              : transaction.cleared === "cleared"
                ? "Cleared"
                : "Uncleared"
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleCleared();
          }}
          disabled={transaction.cleared === "reconciled"}
          className={
            transaction.cleared === "uncleared"
              ? "text-faint hover:text-ink"
              : transaction.cleared === "cleared"
                ? "text-accent"
                : "text-muted"
          }
        >
          {transaction.cleared === "reconciled" ? (
            <Lock size={13} />
          ) : (
            <CheckCircle2
              size={13}
              fill={transaction.cleared === "cleared" ? "currentColor" : "none"}
            />
          )}
        </button>
      </span>
    </div>
  );
}

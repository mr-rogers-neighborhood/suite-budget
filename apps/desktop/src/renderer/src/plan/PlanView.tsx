import {
  addMonths,
  averageSpent,
  type Category,
  type CategoryGroup as CategoryGroupRecord,
  coverOverspending,
  formatMoney,
  lastMonth,
  monthKeyOfDate,
  monthState,
  underfunded,
} from "@suite/budget-core";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { TextPrompt } from "../components/TextPrompt";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";
import { CategoryGroup } from "./CategoryGroup";
import { type AutoAssignKind, MonthHeader } from "./MonthHeader";

type Prompt =
  | { kind: "group"; id: null; name: "" }
  | { kind: "category"; id: string; name: "" }
  | { kind: "rename-group"; id: string; name: string }
  | { kind: "rename-category"; id: string; name: string };

export function PlanView() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const month = useUiStore((state) => state.month);
  const setMonth = useUiStore((state) => state.setMonth);
  const setView = useUiStore((state) => state.setView);
  const setAccountDialog = useUiStore((state) => state.setAccountDialog);
  const setTargetCategory = useUiStore((state) => state.setTargetCategory);
  const setMoveMoneyOpen = useUiStore((state) => state.setMoveMoneyOpen);
  const setNotice = useUiStore((state) => state.setNotice);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const state = useMemo(() => monthState(snapshot, month), [snapshot, month]);
  const currency = snapshot.settings.currency;
  const scale = snapshot.settings.currencyScale;
  const money = (value: number) => formatMoney(value, currency, undefined, scale);

  const toggleGroup = (id: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoAssign = (kind: AutoAssignKind): void => {
    const result =
      kind === "underfunded"
        ? underfunded(state, state.readyToAssignMinor)
        : kind === "last_month"
          ? lastMonth(snapshot, month, state)
          : kind === "average_spent"
            ? averageSpent(snapshot, month, state)
            : coverOverspending(state, state.readyToAssignMinor);

    if (result.deltas.size === 0) {
      setNotice("Nothing to change");
      return;
    }
    replica.document.applyAssignments(month, result.deltas);
    const shortfall =
      result.shortfallMinor > 0 ? ` · ${money(result.shortfallMinor)} still needed` : "";
    setNotice(`Assigned ${money(result.totalMinor)}${shortfall}`);
  };

  const submitPrompt = (value: string): void => {
    if (!prompt) return;
    try {
      if (prompt.kind === "group") {
        replica.document.createCategoryGroup({ name: value });
        setNotice(`Added ${value}`);
      } else if (prompt.kind === "category") {
        replica.document.createCategory({ groupId: prompt.id, name: value });
        setNotice(`Added ${value}`);
      } else if (prompt.kind === "rename-group") {
        replica.document.updateCategoryGroup(prompt.id, { name: value });
      } else {
        replica.document.updateCategory(prompt.id, { name: value });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save", "error");
    }
    setPrompt(null);
  };

  const hideCategory = (category: Category): void => {
    replica.document.updateCategory(category.id, { hidden: !category.hidden });
  };

  const hideGroup = (group: CategoryGroupRecord): void => {
    replica.document.updateCategoryGroup(group.id, { hidden: !group.hidden });
  };

  const deleteCategory = (category: Category): void => {
    if (!window.confirm(`Delete ${category.name}? Its transactions become uncategorized.`)) return;
    try {
      replica.document.deleteCategory(category.id);
      setNotice(`Deleted ${category.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete", "error");
    }
  };

  const deleteGroup = (group: CategoryGroupRecord): void => {
    if (!window.confirm(`Delete ${group.name}? It must be empty.`)) return;
    try {
      replica.document.deleteCategoryGroup(group.id);
      setNotice(`Deleted ${group.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete", "error");
    }
  };

  if (snapshot.accounts.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="Add the accounts your money lives in"
          body="Checking, savings, cash, a credit card, a loan. Only on-budget accounts fund the plan."
          action={
            <Button variant="primary" onClick={() => setAccountDialog(true)}>
              <Plus size={14} />
              Add an account
            </Button>
          }
        />
      </div>
    );
  }

  let rowIndex = 0;
  return (
    <div className="pb-16">
      <MonthHeader
        state={state}
        currency={currency}
        scale={scale}
        onPrevious={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        onToday={() => setMonth(monthKeyOfDate(new Date()))}
        onAutoAssign={autoAssign}
        onMoveMoney={() => setMoveMoneyOpen(true)}
        onAddGroup={() => setPrompt({ kind: "group", id: null, name: "" })}
      />

      {state.uncategorized.count > 0 ? (
        <div className="flex items-center gap-3 border-b border-warn/30 bg-warn/10 px-6 py-2 text-[12px] text-warn">
          <span>
            {state.uncategorized.count} transaction
            {state.uncategorized.count === 1 ? "" : "s"} need a category ·{" "}
            {money(state.uncategorized.amountMinor)}
          </span>
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => {
              const account = snapshot.accounts.find((candidate) => candidate.onBudget);
              if (account) useUiStore.getState().selectAccount(account.id);
              else setView("accounts");
            }}
          >
            Review them
          </button>
        </div>
      ) : null}

      <div className="sticky top-0 z-10 grid grid-cols-[minmax(180px,1fr)_120px_120px_140px] border-b border-line bg-canvas px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
        <span>Category</span>
        <span className="px-2 text-right">Assigned</span>
        <span className="px-2 text-right">Activity</span>
        <span className="px-2 text-right">Available</span>
      </div>

      {state.groups.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No categories yet"
            body="A group holds categories; a category is an envelope. Start with a template or add your own."
            action={
              <Button
                variant="primary"
                onClick={() => setPrompt({ kind: "group", id: null, name: "" })}
              >
                <Plus size={14} />
                Add a group
              </Button>
            }
          />
        </div>
      ) : (
        state.groups.map((group) => {
          const startIndex = rowIndex;
          rowIndex += group.categories.length;
          return (
            <CategoryGroup
              key={group.group.id}
              group={group}
              collapsed={collapsed.has(group.group.id)}
              startIndex={startIndex}
              month={month}
              currency={currency}
              scale={scale}
              onToggle={() => toggleGroup(group.group.id)}
              onAddCategory={(groupId) => setPrompt({ kind: "category", id: groupId, name: "" })}
              onEditTarget={setTargetCategory}
              onMoveMoney={() => setMoveMoneyOpen(true)}
              onRenameCategory={(category) =>
                setPrompt({ kind: "rename-category", id: category.id, name: category.name })
              }
              onHideCategory={hideCategory}
              onDeleteCategory={deleteCategory}
              onRenameGroup={(record) =>
                setPrompt({ kind: "rename-group", id: record.id, name: record.name })
              }
              onHideGroup={hideGroup}
              onDeleteGroup={deleteGroup}
            />
          );
        })
      )}

      <div className="px-6 py-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPrompt({ kind: "group", id: null, name: "" })}
        >
          <Plus size={13} />
          Add group
        </Button>
      </div>

      <TextPrompt
        open={prompt !== null}
        title={
          prompt?.kind === "group"
            ? "Add a group"
            : prompt?.kind === "category"
              ? "Add a category"
              : prompt?.kind === "rename-group"
                ? "Rename group"
                : "Rename category"
        }
        label="Name"
        initialValue={prompt?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setPrompt(null);
        }}
        onConfirm={submitPrompt}
      />
    </div>
  );
}

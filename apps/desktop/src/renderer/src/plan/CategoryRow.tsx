import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  type Category,
  type CategoryMonthState,
  formatMoney,
  type MonthKey,
} from "@suite/budget-core";
import { MoreHorizontal, Target } from "lucide-react";

import { AmountInput } from "../components/AmountInput";
import { IconButton } from "../components/IconButton";
import { Progress } from "../components/Progress";
import { useReplica } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function CategoryRow({
  entry,
  index,
  month,
  currency,
  scale,
  onEditTarget,
  onMoveMoney,
  onRename,
  onHide,
  onDelete,
}: {
  entry: CategoryMonthState;
  index: number;
  month: MonthKey;
  currency: string;
  scale: number;
  onEditTarget: (categoryId: string) => void;
  onMoveMoney: () => void;
  onRename: (category: Category) => void;
  onHide: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const replica = useReplica();
  const setNotice = useUiStore((state) => state.setNotice);
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const available = entry.availableMinor;
  const target = entry.target;

  const focusRow = (direction: number): void => {
    const next = document.querySelector<HTMLInputElement>(
      `[data-assign-row="${index + direction}"] input`,
    );
    next?.focus();
    next?.select();
  };

  return (
    <div
      data-assign-row={index}
      className={`group grid grid-cols-[minmax(180px,1fr)_120px_120px_140px] items-center border-t border-line/60 px-6 text-[13px] ${
        entry.category.hidden ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2 py-1">
        <span className="truncate text-ink">{entry.category.name}</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${entry.category.name}`}
              className="rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              className="z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-xl"
            >
              <Item onSelect={() => onEditTarget(entry.category.id)}>
                {target ? "Edit target" : "Set a target"}
              </Item>
              <Item onSelect={onMoveMoney}>Move money</Item>
              <Item onSelect={() => onRename(entry.category)}>Rename</Item>
              <Item onSelect={() => onHide(entry.category)}>
                {entry.category.hidden ? "Show" : "Hide"}
              </Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <Item danger onSelect={() => onDelete(entry.category)}>
                Delete
              </Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="px-2">
        <AmountInput
          ariaLabel={`Assigned to ${entry.category.name}`}
          valueMinor={entry.assignedMinor}
          currency={currency}
          scale={scale}
          onCommit={(value) => {
            try {
              replica.document.setAssigned(month, entry.category.id, value);
            } catch (error) {
              setNotice(error instanceof Error ? error.message : "Could not assign", "error");
            }
          }}
          onError={(message) => setNotice(message, "error")}
          onNavigate={(direction) => focusRow(direction === "next" ? 1 : -1)}
        />
      </div>

      <div
        className={`tnum px-2 text-right ${
          entry.activityMinor === 0 ? "text-faint" : "text-muted"
        }`}
      >
        {money(entry.activityMinor)}
      </div>

      <div className="flex items-center justify-end gap-2 py-1">
        <div className="min-w-0 text-right">
          <p className={`tnum ${available < 0 ? "font-medium text-negative" : "text-ink"}`}>
            {money(available)}
          </p>
          <p className="text-[10px] text-faint">
            {available < 0
              ? "Overspent"
              : target?.funded
                ? "Funded"
                : target
                  ? `Need ${money(target.suggestionMinor)}`
                  : available > 0
                    ? "Left"
                    : ""}
          </p>
        </div>
        {target ? (
          <button
            type="button"
            onClick={() => onEditTarget(entry.category.id)}
            aria-label={`Target for ${entry.category.name}`}
            title={targetLabel(target)}
            className="w-10 shrink-0"
          >
            <Progress
              value={target.progress}
              tone={target.funded ? "accent" : target.suggestionMinor > 0 ? "warn" : "accent"}
              label={`${entry.category.name} target progress`}
            />
          </button>
        ) : (
          <IconButton
            label={`Set a target for ${entry.category.name}`}
            icon={<Target size={14} />}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => onEditTarget(entry.category.id)}
          />
        )}
      </div>
    </div>
  );
}

function targetLabel(target: NonNullable<CategoryMonthState["target"]>): string {
  if (target.target.kind === "debt_payoff") {
    return `Debt payoff by ${target.target.dueMonth ?? "soon"}`;
  }
  if (target.target.kind === "monthly") return "Every month";
  return `Due ${target.target.dueMonth ?? ""}`;
}

function Item({
  children,
  danger = false,
  onSelect,
}: {
  children: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`cursor-default select-none rounded-md px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-raised ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      {children}
    </DropdownMenu.Item>
  );
}

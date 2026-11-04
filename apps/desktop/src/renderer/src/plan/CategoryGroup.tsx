import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  type Category,
  type CategoryGroup as CategoryGroupRecord,
  formatMoney,
  type GroupMonthState,
  type MonthKey,
} from "@suite/budget-core";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";

import { CategoryRow } from "./CategoryRow";

export function CategoryGroup({
  group,
  collapsed,
  startIndex,
  month,
  currency,
  scale,
  onToggle,
  onAddCategory,
  onEditTarget,
  onMoveMoney,
  onRenameCategory,
  onHideCategory,
  onDeleteCategory,
  onRenameGroup,
  onHideGroup,
  onDeleteGroup,
}: {
  group: GroupMonthState;
  collapsed: boolean;
  startIndex: number;
  month: MonthKey;
  currency: string;
  scale: number;
  onToggle: () => void;
  onAddCategory: (groupId: string) => void;
  onEditTarget: (categoryId: string) => void;
  onMoveMoney: () => void;
  onRenameCategory: (category: Category) => void;
  onHideCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onRenameGroup: (group: CategoryGroupRecord) => void;
  onHideGroup: (group: CategoryGroupRecord) => void;
  onDeleteGroup: (group: CategoryGroupRecord) => void;
}) {
  const money = (value: number) => formatMoney(value, currency, undefined, scale);

  return (
    <div className={group.group.hidden ? "opacity-50" : ""}>
      <div className="group flex items-center gap-2 border-t border-line bg-panel/60 px-6 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            size={13}
            className={`shrink-0 text-faint transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="truncate text-[12px] font-semibold text-muted">{group.group.name}</span>
        </button>
        <span className="tnum w-[120px] px-2 text-right text-[12px] text-faint">
          {money(group.assignedMinor)}
        </span>
        <span className="tnum w-[120px] px-2 text-right text-[12px] text-faint">
          {money(group.activityMinor)}
        </span>
        <span
          className={`tnum w-[140px] px-2 text-right text-[12px] ${
            group.availableMinor < 0 ? "text-negative" : "text-faint"
          }`}
        >
          {money(group.availableMinor)}
        </span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${group.group.name}`}
              className="rounded p-0.5 text-faint opacity-0 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              className="z-50 min-w-44 rounded-lg border border-line bg-panel p-1 shadow-xl"
            >
              <Item onSelect={() => onAddCategory(group.group.id)}>Add category</Item>
              <Item onSelect={() => onRenameGroup(group.group)}>Rename group</Item>
              <Item onSelect={() => onHideGroup(group.group)}>
                {group.group.hidden ? "Show group" : "Hide group"}
              </Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <Item danger onSelect={() => onDeleteGroup(group.group)}>
                Delete group
              </Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {collapsed ? null : (
        <>
          {group.categories.map((entry, index) => (
            <CategoryRow
              key={entry.category.id}
              entry={entry}
              index={startIndex + index}
              month={month}
              currency={currency}
              scale={scale}
              onEditTarget={onEditTarget}
              onMoveMoney={onMoveMoney}
              onRename={onRenameCategory}
              onHide={onHideCategory}
              onDelete={onDeleteCategory}
            />
          ))}
          {group.categories.length === 0 ? (
            <p className="border-t border-line/60 px-10 py-2 text-[12px] text-faint">
              No categories in this group.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onAddCategory(group.group.id)}
            className="flex w-full items-center gap-1.5 border-t border-line/40 px-9 py-1.5 text-left text-[11px] text-faint hover:bg-raised/50 hover:text-muted"
          >
            <Plus size={12} />
            Add category
          </button>
        </>
      )}
    </div>
  );
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

import * as Select from "@radix-ui/react-select";
import type { Category, CategoryGroup } from "@suite/budget-core";
import { Check, ChevronDown } from "lucide-react";

export type CategoryPickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  categories: Category[];
  groups: CategoryGroup[];
  includeReadyToAssign?: boolean;
  allowEmpty?: boolean;
  ariaLabel: string;
  disabled?: boolean;
  id?: string;
};

const NONE = "__none";
const RTA = "rta";

export function CategoryPicker({
  value,
  onChange,
  categories,
  groups,
  includeReadyToAssign = false,
  allowEmpty = true,
  ariaLabel,
  disabled = false,
  id,
}: CategoryPickerProps) {
  const selected = value ?? (allowEmpty ? NONE : RTA);
  const label =
    value === "rta"
      ? "Ready to Assign"
      : (categories.find((category) => category.id === value)?.name ?? "Uncategorized");

  return (
    <Select.Root
      value={selected}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-line bg-raised px-2.5 text-left text-[13px] text-ink disabled:opacity-50"
      >
        <Select.Value placeholder="Uncategorized">{label}</Select.Value>
        <Select.Icon>
          <ChevronDown size={14} className="text-faint" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-panel shadow-xl"
        >
          <Select.Viewport className="scroll max-h-80 overflow-y-auto p-1">
            {allowEmpty ? <Item value={NONE} label="Uncategorized" /> : null}
            {includeReadyToAssign ? <Item value={RTA} label="Ready to Assign (income)" /> : null}
            {groups.map((group) => {
              const children = categories.filter((category) => category.groupId === group.id);
              if (children.length === 0) return null;
              return (
                <Select.Group key={group.id}>
                  <Select.Label className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {group.name}
                  </Select.Label>
                  {children.map((category) => (
                    <Item key={category.id} value={category.id} label={category.name} />
                  ))}
                </Select.Group>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function Item({ value, label }: { value: string; label: string }) {
  return (
    <Select.Item
      value={value}
      className="flex cursor-default select-none items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-raised"
    >
      <Select.ItemText>{label}</Select.ItemText>
      <Select.ItemIndicator>
        <Check size={13} className="text-accent" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

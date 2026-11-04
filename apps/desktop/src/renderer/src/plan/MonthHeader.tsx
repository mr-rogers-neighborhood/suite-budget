import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatMoney, type MonthState, monthLabel } from "@suite/budget-core";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";

import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";

export type AutoAssignKind = "underfunded" | "last_month" | "average_spent" | "cover";

const LABELS: Record<AutoAssignKind, string> = {
  underfunded: "Fund targets",
  last_month: "Copy last month",
  average_spent: "Use 3-month average",
  cover: "Cover overspending",
};

const DESCRIPTIONS: Record<AutoAssignKind, string> = {
  underfunded: "Assign what each target needs this month",
  last_month: "Use the same assignments as last month",
  average_spent: "Base each envelope on the last three months",
  cover: "Fill negative envelopes from Ready to Assign",
};

export function MonthHeader({
  state,
  currency,
  scale,
  onPrevious,
  onNext,
  onToday,
  onAutoAssign,
  onMoveMoney,
  onAddGroup,
}: {
  state: MonthState;
  currency: string;
  scale: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onAutoAssign: (kind: AutoAssignKind) => void;
  onMoveMoney: () => void;
  onAddGroup: () => void;
}) {
  const money = (value: number) => formatMoney(value, currency, undefined, scale);
  const readyTone = state.readyToAssignMinor < 0 ? "text-negative" : "text-ink";

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-2 px-6 pb-3 pt-4">
        <IconButton label="Previous month" icon={<ChevronLeft size={16} />} onClick={onPrevious} />
        <h1 className="min-w-44 text-[15px] font-semibold text-ink">{monthLabel(state.month)}</h1>
        <IconButton label="Next month" icon={<ChevronRight size={16} />} onClick={onNext} />
        <Button size="sm" variant="ghost" onClick={onToday}>
          Today
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm">
                <SlidersHorizontal size={13} />
                Auto-assign
                <ChevronDown size={12} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-64 rounded-lg border border-line bg-panel p-1 shadow-xl"
              >
                {(Object.keys(LABELS) as AutoAssignKind[]).map((kind) => (
                  <DropdownMenu.Item
                    key={kind}
                    onSelect={() => onAutoAssign(kind)}
                    className="cursor-default select-none rounded-md px-2 py-2 outline-none data-[highlighted]:bg-raised"
                  >
                    <p className="text-[12px] font-medium text-ink">{LABELS[kind]}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{DESCRIPTIONS[kind]}</p>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button size="sm" onClick={onMoveMoney}>
            Move money
          </Button>
          <Button size="sm" variant="primary" onClick={onAddGroup}>
            <Plus size={13} />
            Group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 px-6 pb-4">
        <div className="rounded-xl border border-line bg-panel px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            Ready to Assign
          </p>
          <p className={`tnum mt-1 text-[22px] font-semibold ${readyTone}`}>
            {money(state.readyToAssignMinor)}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">
            {state.readyToAssignMinor === 0
              ? "Every dollar has a job"
              : state.readyToAssignMinor > 0
                ? "Not assigned yet"
                : "You have assigned more than you have"}
          </p>
        </div>
        <Summary label="Assigned" value={money(state.assignedMinor)} />
        <Summary label="Activity" value={money(state.activityMinor)} />
        <Summary
          label="Available"
          value={money(state.availableMinor)}
          tone={state.availableMinor < 0 ? "danger" : undefined}
        />
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | undefined;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p
        className={`tnum mt-1 text-[17px] font-medium ${
          tone === "danger" ? "text-negative" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

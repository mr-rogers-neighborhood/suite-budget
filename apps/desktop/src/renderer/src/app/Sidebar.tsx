import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { type Account, formatMoney } from "@suite/budget-core";
import {
  BarChart3,
  CalendarClock,
  ChevronDown,
  Download,
  LayoutGrid,
  ListFilter,
  Plus,
  Tags,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

export function Sidebar({
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
  const setView = useUiStore((state) => state.setView);
  const selectAccount = useUiStore((state) => state.selectAccount);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const setAccountDialog = useUiStore((state) => state.setAccountDialog);
  const [showClosed, setShowClosed] = useState(false);

  const scale = snapshot.settings.currencyScale;
  const currency = snapshot.settings.currency;
  const open = snapshot.accounts.filter((account) => !account.closedAt);
  const closed = snapshot.accounts.filter((account) => account.closedAt);
  const onBudget = open.filter((account) => account.onBudget);
  const offBudget = open.filter((account) => !account.onBudget);

  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="h-6 w-6 rounded-[8px] bg-gradient-to-br from-[#4fbf8b] to-[#2a8f8f]" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-ink">
            {snapshot.meta.name}
          </p>
          <p className="text-[10px] text-faint">Suite Budget</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
        <NavItem
          active={view === "plan"}
          icon={<LayoutGrid size={15} />}
          label="Plan"
          onClick={() => setView("plan")}
        />
        <NavItem
          active={view === "accounts"}
          icon={<Wallet size={15} />}
          label="Accounts"
          onClick={() => setView("accounts")}
        />
        <NavItem
          active={view === "reports"}
          icon={<BarChart3 size={15} />}
          label="Reports"
          onClick={() => setView("reports")}
        />
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">On budget</p>
          <IconButton
            label="Add account"
            icon={<Plus size={14} />}
            onClick={() => setAccountDialog(true)}
          />
        </div>
        <div className="scroll mt-1 overflow-y-auto px-2">
          {onBudget.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              active={view === "accounts" && selectedAccountId === account.id}
              balance={formatMoney(
                replica.document.accountBalance(account.id),
                currency,
                undefined,
                scale,
              )}
              onClick={() => selectAccount(account.id)}
            />
          ))}
          {offBudget.length > 0 ? (
            <>
              <p className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Off budget
              </p>
              {offBudget.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  active={view === "accounts" && selectedAccountId === account.id}
                  balance={formatMoney(
                    replica.document.accountBalance(account.id),
                    currency,
                    undefined,
                    scale,
                  )}
                  onClick={() => selectAccount(account.id)}
                />
              ))}
            </>
          ) : null}
          {closed.length > 0 ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowClosed((value) => !value)}
                className="flex w-full items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
              >
                <ChevronDown size={12} className={showClosed ? "" : "-rotate-90"} />
                Closed ({closed.length})
              </button>
              {showClosed
                ? closed.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      active={view === "accounts" && selectedAccountId === account.id}
                      balance={formatMoney(
                        replica.document.accountBalance(account.id),
                        currency,
                        undefined,
                        scale,
                      )}
                      onClick={() => selectAccount(account.id)}
                    />
                  ))
                : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-line px-2 pt-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
            Tools
          </p>
          <NavItem
            active={view === "schedules"}
            icon={<CalendarClock size={15} />}
            label="Schedules"
            onClick={() => setView("schedules")}
          />
          <NavItem
            active={view === "payees"}
            icon={<Tags size={15} />}
            label="Payees"
            onClick={() => setView("payees")}
          />
          <NavItem
            active={view === "rules"}
            icon={<ListFilter size={15} />}
            label="Rules"
            onClick={() => setView("rules")}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-line p-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" className="w-full">
              <Download size={13} />
              Export
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={6}
              className="z-50 min-w-48 rounded-lg border border-line bg-panel p-1 shadow-xl"
            >
              <Item onSelect={onExportBudget}>Budget file (.budget)</Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <Item onSelect={() => onExportRecords("json")}>Records (JSON)</Item>
              <Item onSelect={() => onExportRecords("csv")}>Transactions (CSV)</Item>
              <Item onSelect={() => onExportRecords("qif")}>Transactions (QIF)</Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <Button size="sm" className="w-full" onClick={onCloseBudget}>
          All budgets
        </Button>
        <p
          className="truncate px-1 text-[10px] text-faint"
          title="A local file; no server, no telemetry"
        >
          Local file · no network
        </p>
      </div>
    </aside>
  );
}

function NavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-2.5 rounded-lg bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-ink"
          : "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-raised hover:text-ink"
      }
    >
      {icon}
      {label}
    </button>
  );
}

function AccountRow({
  account,
  active,
  balance,
  onClick,
}: {
  account: Account;
  active: boolean;
  balance: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "flex w-full items-center justify-between gap-2 rounded-md bg-raised px-2 py-1.5 text-left"
          : "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-raised/60"
      }
    >
      <span className="truncate text-[12px] text-ink">{account.name}</span>
      <span
        className={
          account.closedAt
            ? "tnum shrink-0 text-[11px] text-faint"
            : "tnum shrink-0 text-[11px] text-muted"
        }
      >
        {balance}
      </span>
    </button>
  );
}

function Item({ children, onSelect }: { children: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="cursor-default select-none rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-raised"
    >
      {children}
    </DropdownMenu.Item>
  );
}

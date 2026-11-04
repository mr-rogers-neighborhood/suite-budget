import { addDays, formatMoney, parseMoney, todayKey } from "@suite/budget-core";
import fuzzysort from "fuzzysort";
import { useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "../components/Modal";
import { getBridge } from "../platform/bridge";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

type Entry = {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
};

export function CommandPalette({ onCloseBudget }: { onCloseBudget: () => void }) {
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const setView = useUiStore((state) => state.setView);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const setNewBudgetOpen = useUiStore((state) => state.setNewBudgetOpen);
  const setImportOpen = useUiStore((state) => state.setImportOpen);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    // Focus after the dialog mounts.
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const currency = snapshot.settings.currency;
  const scale = snapshot.settings.currencyScale;
  const quick = useMemo(() => parseQuickAdd(query, snapshot, replica), [query, snapshot, replica]);

  const commands: Entry[] = useMemo(
    () => [
      {
        id: "view-plan",
        label: "Go to Plan",
        hint: "The month grid",
        group: "Go",
        run: () => setView("plan"),
      },
      {
        id: "view-accounts",
        label: "Go to Accounts",
        hint: "Registers and balances",
        group: "Go",
        run: () => setView("accounts"),
      },
      {
        id: "view-reports",
        label: "Go to Reports",
        hint: "Net worth, spending, age of money",
        group: "Go",
        run: () => setView("reports"),
      },
      {
        id: "view-schedules",
        label: "Go to Schedules",
        hint: "Upcoming recurring entries",
        group: "Go",
        run: () => setView("schedules"),
      },
      {
        id: "view-payees",
        label: "Go to Payees",
        hint: "Names and category memory",
        group: "Go",
        run: () => setView("payees"),
      },
      {
        id: "view-rules",
        label: "Go to Rules",
        hint: "Automatic payee and category changes",
        group: "Go",
        run: () => setView("rules"),
      },
      {
        id: "new-transaction",
        label: "New transaction",
        hint: "Open the transaction editor",
        group: "Do",
        run: () => {
          setView("accounts");
          setNewTransactionOpen(true);
        },
      },
      {
        id: "new-budget",
        label: "New budget",
        hint: "Create another local budget",
        group: "Do",
        run: () => setNewBudgetOpen(true),
      },
      {
        id: "import",
        label: "Import transactions",
        hint: "CSV or QIF",
        group: "Do",
        run: () => setImportOpen(true),
      },
      {
        id: "export-budget",
        label: "Export budget file",
        hint: "The .budget envelope",
        group: "Do",
        run: () => void getBridge().exportBudget(),
      },
      {
        id: "export-json",
        label: "Export records as JSON",
        hint: "Every record, plain text",
        group: "Do",
        run: () => void getBridge().exportRecords("json"),
      },
      {
        id: "export-csv",
        label: "Export transactions as CSV",
        hint: "A flat ledger",
        group: "Do",
        run: () => void getBridge().exportRecords("csv"),
      },
      {
        id: "export-qif",
        label: "Export transactions as QIF",
        hint: "For another finance app",
        group: "Do",
        run: () => void getBridge().exportRecords("qif"),
      },
      {
        id: "show-budgets",
        label: "Show all budgets",
        hint: "Back to the launcher",
        group: "Do",
        run: onCloseBudget,
      },
      {
        id: "undo",
        label: "Undo",
        hint: "The last document change",
        group: "Do",
        run: () => replica.undo(),
      },
      {
        id: "redo",
        label: "Redo",
        hint: "The last undone change",
        group: "Do",
        run: () => replica.redo(),
      },
    ],
    [onCloseBudget, replica, setImportOpen, setNewBudgetOpen, setNewTransactionOpen, setView],
  );

  const entityEntries: Entry[] = useMemo(() => {
    const entries: Entry[] = [];
    for (const account of snapshot.accounts) {
      entries.push({
        id: `account-${account.id}`,
        label: account.name,
        hint: `Account · ${formatMoney(replica.document.accountBalance(account.id), currency, undefined, scale)}`,
        group: "Accounts",
        run: () => {
          useUiStore.getState().selectAccount(account.id);
        },
      });
    }
    for (const category of snapshot.categories) {
      entries.push({
        id: `category-${category.id}`,
        label: category.name,
        hint: "Category",
        group: "Categories",
        run: () => {
          useUiStore.getState().setView("plan");
          useUiStore.getState().setTargetCategory(category.id);
        },
      });
    }
    for (const payee of snapshot.payees) {
      entries.push({
        id: `payee-${payee.id}`,
        label: payee.name,
        hint: "Payee",
        group: "Payees",
        run: () => useUiStore.getState().setView("payees"),
      });
    }
    return entries;
  }, [snapshot.accounts, snapshot.categories, snapshot.payees, replica, currency, scale]);

  const all = [...commands, ...entityEntries];
  const results = query
    ? fuzzysort.go(query, all, { key: "label", limit: 20 }).map((result) => result.obj)
    : all.filter((entry) => entry.group !== "Categories" && entry.group !== "Payees").slice(0, 12);

  const items: Entry[] = quick
    ? [
        {
          id: "quick-add",
          label: quick.label,
          hint: "Add this transaction",
          group: "Quick add",
          run: quick.run,
        },
        ...results,
      ]
    : results;

  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [items.length, active]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => Math.min(items.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => Math.max(0, current - 1));
      } else if (event.key === "Enter") {
        const item = items[active];
        if (item) {
          event.preventDefault();
          setOpen(false);
          item.run();
        }
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, items, active, setOpen]);

  return (
    <Modal open={open} onOpenChange={setOpen} title="Command" width="md">
      <input
        ref={input}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        aria-label="Search commands"
        placeholder="Search commands, accounts, categories, or type -12.50 Coffee @Checking #food"
        className="h-9 w-full rounded-md border border-line bg-raised px-2.5 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <ul className="scroll mt-2 max-h-[50vh] space-y-0.5 overflow-y-auto">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left ${
                index === active ? "bg-raised" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
                {item.group}
              </span>
              <span className="max-w-52 truncate text-[11px] text-faint">{item.hint}</span>
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-2 py-4 text-[12px] text-faint">Nothing matches.</li>
        ) : null}
      </ul>
    </Modal>
  );
}

function parseQuickAdd(
  query: string,
  snapshot: ReturnType<typeof useWorkspaceSnapshot>,
  replica: ReturnType<typeof useReplica>,
): { label: string; run: () => void } | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const amountToken = tokens.find((token) => /^-?\d[\d.,]*$/.test(token));
  if (!amountToken) return null;
  const parsed = parseMoney(
    amountToken,
    snapshot.settings.currency,
    snapshot.settings.currencyScale,
  );
  if (parsed.isErr() || parsed.value === 0) return null;
  const amount = parsed.value;

  let account = snapshot.accounts.find((candidate) => candidate.onBudget && !candidate.closedAt);
  let categoryId: string | null = null;
  let date = todayKey();
  const words: string[] = [];
  for (const token of tokens) {
    if (token === amountToken) continue;
    if (token === "today") continue;
    if (token === "yesterday") {
      date = addDays(todayKey(), -1);
      continue;
    }
    if (token === "tomorrow") {
      date = addDays(todayKey(), 1);
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      date = token;
      continue;
    }
    if (token.startsWith("@")) {
      const name = token.slice(1).toLowerCase();
      account =
        snapshot.accounts.find((candidate) => candidate.name.toLowerCase().includes(name)) ??
        account;
      continue;
    }
    if (token.startsWith("#")) {
      const name = token.slice(1).toLowerCase();
      categoryId =
        snapshot.categories.find((candidate) => candidate.name.toLowerCase().includes(name))?.id ??
        null;
      continue;
    }
    words.push(token);
  }

  if (!account) return null;
  const payeeName = words.join(" ").trim();
  const formatted = formatMoney(
    amount,
    snapshot.settings.currency,
    undefined,
    snapshot.settings.currencyScale,
  );
  const label = `${formatted} · ${payeeName || "no payee"} · ${account.name}${
    categoryId
      ? ` · ${snapshot.categories.find((category) => category.id === categoryId)?.name ?? ""}`
      : ""
  }`;
  return {
    label,
    run: () => {
      try {
        replica.document.createTransaction({
          accountId: account.id,
          date,
          amountMinor: amount,
          payeeName,
          categoryId,
        });
        useUiStore.getState().setNotice("Transaction added");
      } catch (error) {
        useUiStore
          .getState()
          .setNotice(error instanceof Error ? error.message : "Could not add", "error");
      }
    },
  };
}

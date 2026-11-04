import {
  type AccountType,
  type CreateBudgetInput,
  currencyScale,
  parseMoney,
  type StarterTemplateId,
} from "@suite/budget-core";
import { useEffect, useState } from "react";

import { Button } from "../components/Button";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "JPY",
  "KRW",
  "INR",
  "BRL",
  "MXN",
  "ZAR",
  "SGD",
  "HKD",
  "KWD",
];

const TEMPLATES: { id: StarterTemplateId; name: string; body: string }[] = [
  {
    id: "essentials",
    name: "Essentials",
    body: "Housing, food, transport, bills, true expenses, savings",
  },
  {
    id: "four_rules",
    name: "Four rules",
    body: "Immediate obligations, true expenses, fun, savings, debt",
  },
  { id: "blank", name: "Blank", body: "No categories; build your own" },
];

const ACCOUNT_TYPES: { id: AccountType; name: string }[] = [
  { id: "checking", name: "Checking" },
  { id: "savings", name: "Savings" },
  { id: "cash", name: "Cash" },
  { id: "credit", name: "Credit card" },
  { id: "loan", name: "Loan" },
];

export function NewBudgetDialog({
  open,
  busy,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateBudgetInput) => void;
}) {
  const [name, setName] = useState("My Budget");
  const [currency, setCurrency] = useState("USD");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(0);
  const [template, setTemplate] = useState<StarterTemplateId>("essentials");
  const [accountName, setAccountName] = useState("Checking");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [onBudget, setOnBudget] = useState(true);
  const [startingBalance, setStartingBalance] = useState("0.00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("My Budget");
    setCurrency("USD");
    setFirstDayOfWeek(0);
    setTemplate("essentials");
    setAccountName("Checking");
    setAccountType("checking");
    setOnBudget(true);
    setStartingBalance("0.00");
    setError(null);
  }, [open]);

  const scale = currencyScale(currency);

  const submit = (): void => {
    if (name.trim().length === 0) {
      setError("Give the budget a name");
      return;
    }
    const parsed = parseMoney(startingBalance, currency, scale);
    if (parsed.isErr()) {
      setError(parsed.error.message);
      return;
    }
    onCreate({
      name: name.trim(),
      currency,
      currencyScale: scale,
      firstDayOfWeek,
      template,
      startingAccount: {
        name: accountName.trim() || "Checking",
        type: accountType,
        onBudget,
        startingBalanceMinor: parsed.value,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New budget"
      description="One file, one currency, one person. You can add more accounts after this."
      width="lg"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create budget"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget name">
            <TextInput
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Household"
            />
          </Field>
          <Field label="Currency" hint="One currency per budget in this version.">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Week starts on">
            <select
              value={firstDayOfWeek}
              onChange={(event) => setFirstDayOfWeek(Number(event.target.value))}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={6}>Saturday</option>
            </select>
          </Field>
          <Field label="Category template">
            <select
              value={template}
              onChange={(event) => setTemplate(event.target.value as StarterTemplateId)}
              className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
            >
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="-mt-2 text-[11px] text-faint">
          {TEMPLATES.find((item) => item.id === template)?.body}
        </p>

        <div className="rounded-lg border border-line bg-canvas/40 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
            First account
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <TextInput
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
              />
            </Field>
            <Field label="Type">
              <select
                value={accountType}
                onChange={(event) => {
                  const next = event.target.value as AccountType;
                  setAccountType(next);
                  if (next === "loan") setOnBudget(false);
                }}
                className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
              >
                {ACCOUNT_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 items-end gap-3">
            <Field label="Starting balance" hint="Use a negative number for money owed.">
              <TextInput
                value={startingBalance}
                inputMode="decimal"
                onChange={(event) => setStartingBalance(event.target.value)}
              />
            </Field>
            <label className="flex h-8 items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={onBudget}
                onChange={(event) => setOnBudget(event.target.checked)}
                className="accent-[var(--accent)]"
              />
              Count this account in the budget
            </label>
          </div>
        </div>

        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

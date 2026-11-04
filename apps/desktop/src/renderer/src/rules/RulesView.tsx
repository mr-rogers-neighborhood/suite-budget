import {
  applyRules,
  type Rule,
  type RuleAction,
  type RuleActionField,
  type RuleCondition,
  type RuleDraft,
  type RuleField,
  type RuleOperator,
  type RuleStage,
} from "@suite/budget-core";
import { Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../components/Button";
import { CategoryPicker } from "../components/CategoryPicker";
import { EmptyState } from "../components/EmptyState";
import { Field, TextInput } from "../components/Field";
import { IconButton } from "../components/IconButton";
import { Modal } from "../components/Modal";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

const STAGES: { id: RuleStage; name: string }[] = [
  { id: "pre", name: "Pre" },
  { id: "default", name: "Default" },
  { id: "post", name: "Post" },
];

const FIELDS: { id: RuleField; name: string }[] = [
  { id: "importedPayee", name: "Imported payee" },
  { id: "payee", name: "Payee" },
  { id: "account", name: "Account" },
  { id: "category", name: "Category" },
  { id: "date", name: "Date" },
  { id: "memo", name: "Memo" },
  { id: "amount", name: "Amount" },
  { id: "cleared", name: "Cleared" },
];

const OPS: { id: RuleOperator; name: string }[] = [
  { id: "is", name: "is" },
  { id: "isNot", name: "is not" },
  { id: "contains", name: "contains" },
  { id: "doesNotContain", name: "does not contain" },
  { id: "matches", name: "matches regex" },
  { id: "oneOf", name: "is one of" },
  { id: "notOneOf", name: "is not one of" },
];

const ACTIONS: { id: RuleActionField; name: string }[] = [
  { id: "setPayee", name: "Set payee" },
  { id: "setCategory", name: "Set category" },
  { id: "setMemo", name: "Set memo" },
  { id: "setFlag", name: "Set flag" },
  { id: "setCleared", name: "Set cleared" },
];

export function RulesView() {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const setNotice = useUiStore((state) => state.setNotice);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [running, setRunning] = useState(false);

  const categoryName = (id: string) =>
    snapshot.categories.find((category) => category.id === id)?.name ?? id;

  const runRules = (): void => {
    setRunning(true);
    try {
      const categoryNames = new Map(
        snapshot.categories.map((category) => [category.id, category.name]),
      );
      let changed = 0;
      replica.document.batch(() => {
        for (const transaction of snapshot.transactions) {
          if (transaction.cleared === "reconciled") continue;
          if (
            transaction.parentId === null &&
            snapshot.transactions.some((child) => child.parentId === transaction.id)
          ) {
            continue;
          }
          const account = snapshot.accounts.find(
            (candidate) => candidate.id === transaction.accountId,
          );
          const draft: RuleDraft = {
            accountId: transaction.accountId,
            accountName: account?.name ?? "",
            payeeName: transaction.payeeName,
            importedPayee: transaction.imported?.originalPayee ?? transaction.payeeName,
            categoryId: transaction.categoryId,
            categoryName:
              transaction.categoryId === "rta"
                ? "Ready to Assign"
                : (categoryNames.get(transaction.categoryId ?? "") ?? ""),
            date: transaction.date,
            memo: transaction.memo,
            amountMinor: transaction.amountMinor,
            cleared: transaction.cleared,
            flag: transaction.flag,
          };
          const result = applyRules(draft, snapshot.rules, {
            currency: snapshot.settings.currency,
            currencyScale: snapshot.settings.currencyScale,
            categoryNames,
          });
          if (result.matchedRuleIds.length === 0) continue;
          const next = result.draft;
          const patch: Parameters<typeof replica.document.updateTransaction>[1] = {};
          if (next.categoryId !== draft.categoryId) patch.categoryId = next.categoryId;
          if (next.memo !== draft.memo) patch.memo = next.memo;
          if (next.flag !== draft.flag) patch.flag = next.flag;
          if (next.cleared !== draft.cleared && next.cleared !== "reconciled") {
            patch.cleared = next.cleared;
          }
          if (next.payeeName !== draft.payeeName) {
            patch.payeeName = next.payeeName;
            patch.payeeId = null;
          }
          if (Object.keys(patch).length === 0) continue;
          replica.document.updateTransaction(transaction.id, patch, undefined, { learn: false });
          changed += 1;
        }
      });
      setNotice(
        changed === 0 ? "Rules made no changes" : `Rules updated ${changed} transaction(s)`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not run rules", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <div>
          <h1 className="text-[16px] font-semibold text-ink">Rules</h1>
          <p className="mt-0.5 text-[11px] text-faint">
            Rules run on import and when you ask. A specific rule runs after a broad one.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={runRules} disabled={running}>
            <Play size={13} />
            {running ? "Running…" : "Run rules"}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            <Plus size={13} />
            Add rule
          </Button>
        </div>
      </div>

      {snapshot.rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          body="A rule can set a payee, category, memo, flag, or cleared status when a transaction matches. Rules you teach by categorizing appear here too."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus size={14} />
              Add rule
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {snapshot.rules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-line bg-panel px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-faint">
                  {rule.stage}
                </span>
                {rule.source === "learned" ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
                    learned
                  </span>
                ) : null}
                {!rule.enabled ? <span className="text-[10px] text-faint">disabled</span> : null}
                <button
                  type="button"
                  className="ml-auto text-[11px] text-faint hover:text-ink"
                  onClick={() => replica.document.updateRule(rule.id, { enabled: !rule.enabled })}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="text-[11px] text-faint hover:text-ink"
                  onClick={() => setEditing(rule)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-[11px] text-danger hover:underline"
                  onClick={() => {
                    replica.document.deleteRule(rule.id);
                    setNotice("Rule deleted");
                  }}
                >
                  Delete
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                <span className="text-faint">When </span>
                {rule.conditions
                  .map((condition) => `${condition.field} ${condition.op} "${condition.value}"`)
                  .join(" and ")}
                <span className="text-faint"> then </span>
                {rule.actions
                  .map((action) =>
                    action.field === "setCategory"
                      ? `set category to ${categoryName(action.value)}`
                      : `${action.field} ${action.value}`,
                  )
                  .join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <RuleDialog
        rule={editing}
        onClose={() => setEditing(null)}
        onError={(message) => setNotice(message, "error")}
      />
    </div>
  );
}

function RuleDialog({
  rule,
  onClose,
  onError,
}: {
  rule: Rule | "new" | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();
  const isNew = rule === "new";
  const record = rule && rule !== "new" ? rule : undefined;
  const [stage, setStage] = useState<RuleStage>("default");
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const seeded = useRef<string | null>(null);

  const currentKey = record?.id ?? (isNew ? "new" : null);
  useEffect(() => {
    if (!rule) {
      seeded.current = null;
      return;
    }
    if (seeded.current === currentKey) return;
    seeded.current = currentKey;
    setStage(record?.stage ?? "default");
    setConditions(
      record?.conditions.length
        ? record.conditions
        : [{ field: "importedPayee", op: "contains", value: "" }],
    );
    setActions(record?.actions.length ? record.actions : [{ field: "setCategory", value: "" }]);
  }, [rule, currentKey, record]);

  if (!rule) return null;

  const save = (): void => {
    const cleanConditions = conditions.filter((condition) => condition.value.trim().length > 0);
    const cleanActions = actions.filter((action) => action.value.trim().length > 0);
    if (cleanConditions.length === 0) {
      onError("Add at least one condition");
      return;
    }
    if (cleanActions.length === 0) {
      onError("Add at least one action");
      return;
    }
    try {
      if (isNew) {
        replica.document.createRule({ stage, conditions: cleanConditions, actions: cleanActions });
      } else if (record) {
        replica.document.updateRule(record.id, {
          stage,
          conditions: cleanConditions,
          actions: cleanActions,
        });
      }
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save the rule");
    }
  };

  return (
    <Modal
      open={rule !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isNew ? "Add rule" : "Edit rule"}
      description="Conditions in a rule are combined with AND. Actions run in order."
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save rule
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Stage">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as RuleStage)}
            className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[13px] text-ink"
          >
            {STAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Conditions
          </p>
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div
                key={`${condition.field}-${condition.op}-${condition.value}`}
                className="grid grid-cols-[1fr_130px_1fr_28px] gap-2"
              >
                <select
                  value={condition.field}
                  aria-label={`Condition ${index + 1} field`}
                  onChange={(event) =>
                    setConditions((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, field: event.target.value as RuleField }
                          : row,
                      ),
                    )
                  }
                  className="h-8 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                >
                  {FIELDS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={condition.op}
                  aria-label={`Condition ${index + 1} operator`}
                  onChange={(event) =>
                    setConditions((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, op: event.target.value as RuleOperator }
                          : row,
                      ),
                    )
                  }
                  className="h-8 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                >
                  {OPS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <TextInput
                  value={condition.value}
                  aria-label={`Condition ${index + 1} value`}
                  onChange={(event) =>
                    setConditions((rows) =>
                      rows.map((row, position) =>
                        position === index ? { ...row, value: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="Value"
                />
                <IconButton
                  label={`Remove condition ${index + 1}`}
                  icon={<Trash2 size={13} />}
                  disabled={conditions.length === 1}
                  onClick={() =>
                    setConditions((rows) => rows.filter((_, position) => position !== index))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              setConditions((rows) => [...rows, { field: "memo", op: "contains", value: "" }])
            }
          >
            <Plus size={12} />
            Add condition
          </Button>
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            Actions
          </p>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div
                key={`${action.field}-${action.value}`}
                className="grid grid-cols-[1fr_1.4fr_28px] gap-2"
              >
                <select
                  value={action.field}
                  aria-label={`Action ${index + 1} field`}
                  onChange={(event) =>
                    setActions((rows) =>
                      rows.map((row, position) =>
                        position === index
                          ? { ...row, field: event.target.value as RuleActionField }
                          : row,
                      ),
                    )
                  }
                  className="h-8 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                >
                  {ACTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {action.field === "setCategory" ? (
                  <CategoryPicker
                    value={action.value || null}
                    onChange={(value) =>
                      setActions((rows) =>
                        rows.map((row, position) =>
                          position === index ? { ...row, value: value ?? "" } : row,
                        ),
                      )
                    }
                    categories={snapshot.categories}
                    groups={snapshot.categoryGroups}
                    ariaLabel={`Action ${index + 1} category`}
                  />
                ) : action.field === "setFlag" ? (
                  <select
                    value={action.value}
                    aria-label={`Action ${index + 1} flag`}
                    onChange={(event) =>
                      setActions((rows) =>
                        rows.map((row, position) =>
                          position === index ? { ...row, value: event.target.value } : row,
                        ),
                      )
                    }
                    className="h-8 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                  >
                    <option value="">Choose…</option>
                    {["red", "orange", "yellow", "green", "blue", "purple"].map((flag) => (
                      <option key={flag} value={flag}>
                        {flag}
                      </option>
                    ))}
                  </select>
                ) : action.field === "setCleared" ? (
                  <select
                    value={action.value}
                    aria-label={`Action ${index + 1} cleared`}
                    onChange={(event) =>
                      setActions((rows) =>
                        rows.map((row, position) =>
                          position === index ? { ...row, value: event.target.value } : row,
                        ),
                      )
                    }
                    className="h-8 rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                  >
                    <option value="">Choose…</option>
                    <option value="cleared">Cleared</option>
                    <option value="uncleared">Uncleared</option>
                  </select>
                ) : (
                  <TextInput
                    value={action.value}
                    aria-label={`Action ${index + 1} value`}
                    onChange={(event) =>
                      setActions((rows) =>
                        rows.map((row, position) =>
                          position === index ? { ...row, value: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Value"
                  />
                )}
                <IconButton
                  label={`Remove action ${index + 1}`}
                  icon={<Trash2 size={13} />}
                  disabled={actions.length === 1}
                  onClick={() =>
                    setActions((rows) => rows.filter((_, position) => position !== index))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => setActions((rows) => [...rows, { field: "setMemo", value: "" }])}
          >
            <Plus size={12} />
            Add action
          </Button>
        </section>
      </div>
    </Modal>
  );
}

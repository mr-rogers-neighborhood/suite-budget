import {
  applyRules,
  type CsvMapping,
  detectDelimiter,
  findDuplicateCandidates,
  formatMoney,
  type ImportBatch,
  parseCsv,
  parseCsvRows,
  parseQif,
  type RuleDraft,
} from "@suite/budget-core";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../components/Button";
import { Field, TextInput } from "../components/Field";
import { Modal } from "../components/Modal";
import { getBridge } from "../platform/bridge";
import { useReplica, useWorkspaceSnapshot } from "../store/snapshotStore";
import { useUiStore } from "../store/uiStore";

type Step = "choose" | "map" | "review";

export function ImportWizard() {
  const open = useUiStore((state) => state.importOpen);
  const setOpen = useUiStore((state) => state.setImportOpen);
  const setNotice = useUiStore((state) => state.setNotice);
  const snapshot = useWorkspaceSnapshot();
  const replica = useReplica();

  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"csv" | "qif" | "unknown">("unknown");
  const [accountId, setAccountId] = useState("");
  const [dateFormat, setDateFormat] = useState<"iso" | "us" | "eu">("us");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createCategories, setCreateCategories] = useState(true);
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);
  const [mapping, setMapping] = useState<CsvMapping>({
    delimiter: ",",
    hasHeader: true,
    skipRows: 0,
    dateColumn: 0,
    dateFormat: "us",
    payeeColumn: 1,
    memoColumn: 2,
    amountColumn: 3,
    inflowColumn: null,
    outflowColumn: null,
    categoryColumn: 4,
    negate: false,
  });

  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current) return;
    seeded.current = true;
    setStep("choose");
    setName("");
    setText("");
    setFormat("unknown");
    setError(null);
    setSkipRows(new Set());
    setAccountId(
      snapshot.accounts.find((account) => account.onBudget && !account.closedAt)?.id ??
        snapshot.accounts[0]?.id ??
        "",
    );
  }, [open, snapshot.accounts]);

  const rows = useMemo(() => {
    if (!text) return null;
    if (format === "csv") {
      return parseCsv(text, mapping, snapshot.settings.currency, snapshot.settings.currencyScale);
    }
    if (format === "qif") {
      return parseQif(text, snapshot.settings.currency, snapshot.settings.currencyScale, {
        dateFormat,
      });
    }
    return null;
  }, [
    text,
    format,
    mapping,
    dateFormat,
    snapshot.settings.currency,
    snapshot.settings.currencyScale,
  ]);

  const batch: ImportBatch | null = rows?.isOk() ? rows.value : null;
  const readError = rows?.isErr() ? rows.error.message : null;
  const duplicateRows = useMemo(() => {
    if (!batch || !accountId) return new Map<number, string>();
    const result = new Map<number, string>();
    batch.rows.forEach((row, index) => {
      const candidates = findDuplicateCandidates(snapshot.transactions, row, accountId);
      if (candidates.length > 0) result.set(index, candidates[0]?.transactionId ?? "");
    });
    return result;
  }, [batch, accountId, snapshot.transactions]);

  const money = (value: number) =>
    formatMoney(value, snapshot.settings.currency, undefined, snapshot.settings.currencyScale);

  const chooseFile = async (): Promise<void> => {
    setError(null);
    const result = await getBridge().readImportSource();
    if (result.canceled || !result.text) return;
    setName(result.name ?? "file");
    setText(result.text);
    const lower = (result.name ?? "").toLowerCase();
    if (lower.endsWith(".qif")) {
      setFormat("qif");
      setStep("map");
    } else if (lower.endsWith(".csv")) {
      setFormat("csv");
      const delimiter = detectDelimiter(result.text);
      const parsed = parseCsvRows(result.text, delimiter);
      setMapping({
        ...guessMapping(parsed),
        delimiter,
        hasHeader: true,
        skipRows: 0,
        dateFormat: guessDateFormat(result.text),
      });
      setStep("map");
    } else {
      setError("Choose a CSV or QIF file. Use Open File for a Suite Budget JSON or .budget file.");
    }
  };

  const handleImport = (): void => {
    if (!batch || !accountId) return;
    const currency = snapshot.settings.currency;
    const scale = snapshot.settings.currencyScale;
    const categoryNames = new Map(
      snapshot.categories.map((category) => [category.id, category.name]),
    );
    const categoryByName = new Map(
      snapshot.categories.map((category) => [category.name.toLowerCase(), category.id]),
    );
    const account = snapshot.accounts.find((candidate) => candidate.id === accountId);
    if (!account) return;

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      replica.document.batch(() => {
        let importedGroupId: string | null = null;
        const ensureImportedGroup = (): string => {
          if (importedGroupId) return importedGroupId;
          const existing = snapshot.categoryGroups.find(
            (group) => group.name.toLowerCase() === "imported",
          );
          importedGroupId =
            existing?.id ?? replica.document.createCategoryGroup({ name: "Imported" }).id;
          return importedGroupId;
        };
        const ensureCategory = (categoryName: string | null): string | null => {
          if (!categoryName) return null;
          const existing = categoryByName.get(categoryName.toLowerCase());
          if (existing) return existing;
          if (!createCategories) return null;
          const created = replica.document.createCategory({
            groupId: ensureImportedGroup(),
            name: categoryName,
          });
          categoryByName.set(categoryName.toLowerCase(), created.id);
          return created.id;
        };

        batch.rows.forEach((row, index) => {
          if (skipRows.has(index)) {
            skipped += 1;
            return;
          }
          if (skipDuplicates && duplicateRows.has(index)) {
            skipped += 1;
            return;
          }
          try {
            const rawCategoryId = ensureCategory(row.categoryName);
            const draft: RuleDraft = {
              accountId,
              accountName: account.name,
              payeeName: row.payeeName,
              importedPayee: row.payeeName,
              categoryId: rawCategoryId,
              categoryName: row.categoryName ?? "",
              date: row.date,
              memo: row.memo,
              amountMinor: row.amountMinor,
              cleared: row.cleared,
              flag: null,
            };
            const ruled = applyRules(draft, snapshot.rules, {
              currency,
              currencyScale: scale,
              categoryNames,
            }).draft;

            if (row.splits.length >= 2) {
              replica.document.createSplit({
                accountId,
                date: row.date,
                payeeName: ruled.payeeName,
                memo: ruled.memo,
                cleared: row.cleared,
                splits: row.splits.map((split) => ({
                  categoryId: ensureCategory(split.categoryName),
                  amountMinor: split.amountMinor,
                  memo: split.memo,
                })),
              });
            } else if (row.transferAccountName) {
              const other = snapshot.accounts.find(
                (candidate) =>
                  candidate.name.toLowerCase() === row.transferAccountName?.toLowerCase(),
              );
              if (other) {
                replica.document.createTransfer({
                  fromAccount: account,
                  toAccount: other,
                  date: row.date,
                  amountMinor: Math.abs(row.amountMinor),
                  categoryId: ruled.categoryId,
                  memo: ruled.memo,
                  cleared: row.cleared,
                });
              } else {
                replica.document.createTransaction({
                  accountId,
                  date: row.date,
                  amountMinor: row.amountMinor,
                  payeeName: `Transfer: ${row.transferAccountName}`,
                  categoryId: ruled.categoryId,
                  memo: ruled.memo,
                  cleared: row.cleared,
                });
              }
            } else {
              replica.document.createTransaction({
                accountId,
                date: row.date,
                amountMinor: ruled.amountMinor,
                payeeName: ruled.payeeName,
                categoryId: ruled.categoryId,
                memo: ruled.memo,
                cleared: ruled.cleared,
                flag: ruled.flag,
              });
            }
            imported += 1;
          } catch {
            failed += 1;
          }
        });
      });
      setNotice(
        `Imported ${imported}${skipped > 0 ? `, skipped ${skipped}` : ""}${
          failed > 0 ? `, ${failed} failed` : ""
        }`,
        failed > 0 ? "error" : "info",
      );
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const columnOptions = useMemo(() => {
    if (!text) return [];
    const delimiter = mapping.delimiter;
    const parsed = parseCsvRows(text, delimiter);
    const header = parsed[0] ?? [];
    const count = Math.max(header.length, ...parsed.slice(0, 5).map((row) => row.length), 0);
    return Array.from({ length: count }, (_, index) => ({
      index,
      label:
        mapping.hasHeader && header[index]
          ? `${index + 1}. ${header[index]}`
          : `Column ${index + 1}`,
    }));
  }, [text, mapping.delimiter, mapping.hasHeader]);

  const setColumn = (key: keyof CsvMapping, value: string): void => {
    const index = value === "" ? null : Number(value);
    setMapping((current) => ({ ...current, [key]: index }) as CsvMapping);
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Import transactions"
      description="CSV and QIF are read into the open budget. Rules run before the review, and the review can skip likely duplicates."
      width="xl"
      footer={
        <>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          {step !== "choose" ? (
            <Button onClick={() => setStep(step === "review" ? "map" : "choose")}>Back</Button>
          ) : null}
          {step === "map" && batch ? (
            <Button variant="primary" onClick={() => setStep("review")}>
              Review {batch.rows.length} rows
            </Button>
          ) : null}
          {step === "review" ? (
            <Button variant="primary" onClick={handleImport} disabled={!batch}>
              Import
            </Button>
          ) : null}
        </>
      }
    >
      {step === "choose" ? (
        <div className="grid gap-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Export a CSV or QIF file from your bank, then choose it here. Nothing is sent anywhere.
          </p>
          <Button variant="primary" onClick={() => void chooseFile()} className="w-fit">
            Choose a file…
          </Button>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        </div>
      ) : null}

      {step === "map" ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas/40 px-3 py-2 text-[12px]">
            <span className="font-medium text-ink">{name}</span>
            <span className="text-faint">{format.toUpperCase()}</span>
            <label className="ml-auto flex items-center gap-2 text-muted">
              Into
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="h-7 rounded border border-line bg-raised px-1.5 text-[12px] text-ink"
              >
                {snapshot.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {format === "csv" ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-4 gap-2">
                <Field label="Delimiter">
                  <TextInput
                    value={mapping.delimiter}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        delimiter: event.target.value || ",",
                      }))
                    }
                  />
                </Field>
                <Field label="Header row">
                  <select
                    value={mapping.hasHeader ? "yes" : "no"}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        hasHeader: event.target.value === "yes",
                      }))
                    }
                    className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Field>
                <Field label="Date format">
                  <select
                    value={mapping.dateFormat}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        dateFormat: event.target.value as "iso" | "us" | "eu",
                      }))
                    }
                    className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
                  >
                    <option value="iso">YYYY-MM-DD</option>
                    <option value="us">MM/DD/YYYY</option>
                    <option value="eu">DD/MM/YYYY</option>
                  </select>
                </Field>
                <label className="flex items-end gap-2 pb-1.5 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={mapping.negate}
                    onChange={(event) =>
                      setMapping((current) => ({ ...current, negate: event.target.checked }))
                    }
                    className="accent-[var(--accent)]"
                  />
                  Flip signs
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <ColumnSelect
                  label="Date"
                  value={mapping.dateColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("dateColumn", value)}
                />
                <ColumnSelect
                  label="Payee"
                  value={mapping.payeeColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("payeeColumn", value)}
                />
                <ColumnSelect
                  label="Memo"
                  value={mapping.memoColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("memoColumn", value)}
                  allowNone
                />
                <ColumnSelect
                  label="Amount"
                  value={mapping.amountColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("amountColumn", value)}
                  allowNone
                />
                <ColumnSelect
                  label="Inflow"
                  value={mapping.inflowColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("inflowColumn", value)}
                  allowNone
                />
                <ColumnSelect
                  label="Outflow"
                  value={mapping.outflowColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("outflowColumn", value)}
                  allowNone
                />
                <ColumnSelect
                  label="Category"
                  value={mapping.categoryColumn}
                  options={columnOptions}
                  onChange={(value) => setColumn("categoryColumn", value)}
                  allowNone
                />
              </div>
            </div>
          ) : (
            <Field label="Date format">
              <select
                value={dateFormat}
                onChange={(event) => setDateFormat(event.target.value as "iso" | "us" | "eu")}
                className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
              >
                <option value="us">MM/DD/YYYY</option>
                <option value="eu">DD/MM/YYYY</option>
                <option value="iso">YYYY-MM-DD</option>
              </select>
            </Field>
          )}

          {readError ? <p className="text-[12px] text-danger">{readError}</p> : null}
          {batch ? <Preview batch={batch} money={money} /> : null}
        </div>
      ) : null}

      {step === "review" && batch ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-canvas/40 px-3 py-2 text-[12px]">
            <span className="text-muted">{batch.rows.length} rows</span>
            <span className="text-faint">{batch.errors.length} errors</span>
            <span className="text-faint">{duplicateRows.size} possible duplicates</span>
            <label className="ml-auto flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="accent-[var(--accent)]"
              />
              Skip likely duplicates
            </label>
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={createCategories}
                onChange={(event) => setCreateCategories(event.target.checked)}
                className="accent-[var(--accent)]"
              />
              Create missing categories
            </label>
          </div>
          <div className="scroll max-h-[45vh] overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-panel">
                <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                  <th className="px-3 py-1.5">Import</th>
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Payee</th>
                  <th className="px-3 py-1.5">Category</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((row, index) => {
                  const duplicate = duplicateRows.get(index);
                  return (
                    <tr
                      key={`${row.date}-${row.payeeName}-${row.amountMinor}-${row.categoryName ?? ""}`}
                      className="border-t border-line/50"
                    >
                      <td className="px-3 py-1">
                        <input
                          type="checkbox"
                          checked={!skipRows.has(index)}
                          onChange={(event) =>
                            setSkipRows((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.delete(index);
                              else next.add(index);
                              return next;
                            })
                          }
                          aria-label={`Import row ${index + 1}`}
                          className="accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-3 py-1 text-muted">{row.date}</td>
                      <td className="max-w-48 truncate px-3 py-1 text-ink">{row.payeeName}</td>
                      <td className="px-3 py-1 text-muted">{row.categoryName ?? "—"}</td>
                      <td className="tnum px-3 py-1 text-right text-ink">
                        {money(row.amountMinor)}
                      </td>
                      <td className="px-3 py-1 text-[10px] text-faint">
                        {duplicate ? "Possible duplicate" : row.splits.length > 0 ? "Split" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {batch.errors.length > 0 ? (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-danger/30 bg-danger/5 p-2 text-[11px] text-danger">
              {batch.errors.map((error) => (
                <p key={`${error.row}-${error.message}`}>
                  Row {error.row}: {error.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: number | null;
  options: { index: number; label: string }[];
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-md border border-line bg-raised px-2 text-[12px] text-ink"
      >
        {allowNone ? <option value="">—</option> : null}
        {options.map((option) => (
          <option key={option.index} value={option.index}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Preview({ batch, money }: { batch: ImportBatch; money: (value: number) => string }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
      <table className="w-full text-[12px]">
        <thead className="bg-panel">
          <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
            <th className="px-3 py-1.5">Date</th>
            <th className="px-3 py-1.5">Payee</th>
            <th className="px-3 py-1.5">Category</th>
            <th className="px-3 py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {batch.rows.slice(0, 20).map((row) => (
            <tr
              key={`${row.date}-${row.payeeName}-${row.amountMinor}-${row.categoryName ?? ""}`}
              className="border-t border-line/50"
            >
              <td className="px-3 py-1 text-muted">{row.date}</td>
              <td className="max-w-56 truncate px-3 py-1 text-ink">{row.payeeName}</td>
              <td className="px-3 py-1 text-muted">{row.categoryName ?? "—"}</td>
              <td className="tnum px-3 py-1 text-right text-ink">{money(row.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {batch.errors.length > 0 ? (
        <p className="border-t border-line px-3 py-1 text-[11px] text-danger">
          {batch.errors.length} rows could not be read
        </p>
      ) : null}
    </div>
  );
}

function guessMapping(rows: string[][]): CsvMapping {
  const header = (rows[0] ?? []).map((cell) => cell.toLowerCase());
  const find = (pattern: RegExp, fallback: number): number => {
    const index = header.findIndex((cell) => pattern.test(cell));
    return index >= 0 ? index : fallback;
  };
  return {
    delimiter: ",",
    hasHeader: true,
    skipRows: 0,
    dateColumn: find(/date/, 0),
    dateFormat: "us",
    payeeColumn: find(/payee|description|name|merchant/, 1),
    memoColumn: find(/memo|note|detail/, 2),
    amountColumn: find(/^amount$|value/, 3),
    inflowColumn: find(/inflow|credit|deposit/, -1) >= 0 ? find(/inflow|credit|deposit/, -1) : null,
    outflowColumn:
      find(/outflow|debit|withdraw/, -1) >= 0 ? find(/outflow|debit|withdraw/, -1) : null,
    categoryColumn: find(/category/, -1) >= 0 ? find(/category/, -1) : null,
    negate: false,
  };
}

function guessDateFormat(text: string): "iso" | "us" | "eu" {
  const first = text.split(/\r?\n/, 2)[1] ?? "";
  if (/\d{4}-\d{2}-\d{2}/.test(first)) return "iso";
  return "us";
}

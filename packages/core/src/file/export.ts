import { partsOfDateKey } from "../dates";
import { formatMoneyPlain } from "../money";
import type { BudgetSnapshot, Transaction } from "../schema";

export function transactionsToCsv(snapshot: BudgetSnapshot): string {
  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account.name]));
  const payees = new Map(snapshot.payees.map((payee) => [payee.id, payee.name]));
  const categories = new Map(snapshot.categories.map((category) => [category.id, category.name]));
  const scale = snapshot.settings.currencyScale;
  const parents = new Set(
    snapshot.transactions
      .map((transaction) => transaction.parentId)
      .filter((id): id is string => id !== null),
  );
  const lines = ["Date,Account,Payee,Category,Memo,Amount,Cleared,Flag"];

  const write = (transaction: Transaction, category: string): void => {
    lines.push(
      [
        transaction.date,
        accounts.get(transaction.accountId) ?? "",
        payees.get(transaction.payeeId ?? "") ?? transaction.payeeName,
        category,
        transaction.memo,
        formatMoneyPlain(transaction.amountMinor, scale),
        transaction.cleared,
        transaction.flag ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  };

  for (const transaction of snapshot.transactions) {
    if (transaction.parentId !== null) continue;
    if (parents.has(transaction.id)) {
      for (const child of snapshot.transactions) {
        if (child.parentId !== transaction.id) continue;
        write(child, categories.get(child.categoryId ?? "") ?? "Split");
      }
      continue;
    }
    write(
      transaction,
      transaction.categoryId === "rta"
        ? "Ready to Assign"
        : (categories.get(transaction.categoryId ?? "") ?? ""),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function transactionsToQif(snapshot: BudgetSnapshot): string {
  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account.name]));
  const categories = new Map(snapshot.categories.map((category) => [category.id, category.name]));
  const scale = snapshot.settings.currencyScale;
  const parents = new Set(
    snapshot.transactions
      .map((transaction) => transaction.parentId)
      .filter((id): id is string => id !== null),
  );
  const lines = ["!Type:Bank"];

  for (const transaction of snapshot.transactions) {
    if (transaction.parentId !== null) continue;
    const { year, month, day } = partsOfDateKey(transaction.date);
    lines.push(`D${month}/${day}/${year}`);
    lines.push(`T${formatMoneyPlain(transaction.amountMinor, scale)}`);
    if (transaction.payeeName) lines.push(`P${transaction.payeeName}`);
    if (transaction.memo) lines.push(`M${transaction.memo}`);
    if (transaction.transferAccountId) {
      lines.push(`L[${accounts.get(transaction.transferAccountId) ?? ""}]`);
    } else if (transaction.categoryId && transaction.categoryId !== "rta") {
      lines.push(`L${categories.get(transaction.categoryId) ?? ""}`);
    }
    if (transaction.cleared === "reconciled") lines.push("CR");
    else if (transaction.cleared === "cleared") lines.push("C*");

    if (parents.has(transaction.id)) {
      for (const child of snapshot.transactions) {
        if (child.parentId !== transaction.id) continue;
        lines.push(`S${categories.get(child.categoryId ?? "") ?? ""}`);
        if (child.memo) lines.push(`E${child.memo}`);
        lines.push(`$${formatMoneyPlain(child.amountMinor, scale)}`);
      }
    }
    lines.push("^");
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

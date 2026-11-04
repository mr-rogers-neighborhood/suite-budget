export type IdPrefix =
  | "acct"
  | "grp"
  | "cat"
  | "tgt"
  | "txn"
  | "payee"
  | "rule"
  | "sched"
  | "recon"
  | "dash"
  | "widget"
  | "budget"
  | "transfer";

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

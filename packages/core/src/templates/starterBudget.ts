import type { StarterTemplateId } from "../ports";

export type StarterCategory = { name: string; target?: number };
export type StarterGroup = { name: string; categories: StarterCategory[] };

const ESSENTIALS: StarterGroup[] = [
  {
    name: "Immediate Obligations",
    categories: [
      { name: "Rent / Mortgage" },
      { name: "Utilities" },
      { name: "Groceries" },
      { name: "Transportation" },
      { name: "Insurance" },
      { name: "Phone & Internet" },
    ],
  },
  {
    name: "True Expenses",
    categories: [
      { name: "Auto Maintenance" },
      { name: "Home Maintenance" },
      { name: "Medical" },
      { name: "Taxes" },
      { name: "Annual Subscriptions" },
    ],
  },
  {
    name: "Quality of Life",
    categories: [
      { name: "Dining Out" },
      { name: "Entertainment" },
      { name: "Hobbies" },
      { name: "Gifts" },
    ],
  },
  {
    name: "Savings",
    categories: [{ name: "Emergency Fund" }, { name: "Vacation" }],
  },
];

const FOUR_RULES: StarterGroup[] = [
  {
    name: "Immediate Obligations",
    categories: [
      { name: "Rent / Mortgage" },
      { name: "Utilities" },
      { name: "Groceries" },
      { name: "Transportation" },
    ],
  },
  {
    name: "True Expenses",
    categories: [
      { name: "Auto Maintenance" },
      { name: "Home Maintenance" },
      { name: "Medical" },
      { name: "Annual Subscriptions" },
    ],
  },
  {
    name: "Quality of Life",
    categories: [{ name: "Dining Out" }, { name: "Entertainment" }, { name: "Gifts" }],
  },
  {
    name: "Savings",
    categories: [{ name: "Emergency Fund" }],
  },
  {
    name: "Debt",
    categories: [{ name: "Loan Payments" }],
  },
];

export function starterGroups(template: StarterTemplateId): StarterGroup[] {
  if (template === "blank") return [];
  if (template === "four_rules") return FOUR_RULES;
  return ESSENTIALS;
}

import type { Meta, StoryObj } from "@storybook/react-vite";
import { formatMoney } from "@suite/budget-core";

import { BarChart, LineChart } from "./Charts";

const format = (value: number) => formatMoney(value, "USD");

const meta = {
  title: "Charts/Charts",
  component: LineChart,
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NetWorth: Story = {
  args: {
    ariaLabel: "Net worth over time",
    format,
    points: [
      { label: "Jan", value: 120_000 },
      { label: "Feb", value: 135_000 },
      { label: "Mar", value: 128_000 },
      { label: "Apr", value: 160_000 },
      { label: "May", value: 175_000 },
    ],
  },
};

export const IncomeAndExpense: Story = {
  args: { points: [], format, ariaLabel: "Income and expense" },
  render: () => (
    <BarChart
      ariaLabel="Income and expense"
      format={format}
      labels={["Jan", "Feb", "Mar", "Apr"]}
      series={[
        { label: "Income", color: "var(--chart-1)", values: [400_000, 410_000, 395_000, 420_000] },
        { label: "Expense", color: "var(--chart-2)", values: [310_000, 350_000, 280_000, 360_000] },
      ]}
    />
  ),
};

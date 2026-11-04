import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart, LineChart } from "./Charts";

const format = (value: number) => `$${(value / 100).toFixed(2)}`;

describe("charts", () => {
  it("should label a line chart and expose its data table", () => {
    render(
      <LineChart
        points={[
          { label: "Jan", value: 1000 },
          { label: "Feb", value: 2000 },
        ]}
        format={format}
        ariaLabel="Net worth over time"
      />,
    );
    expect(screen.getByRole("img", { name: "Net worth over time" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Data table"));
    expect(screen.getAllByText("Jan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$20.00").length).toBeGreaterThan(0);
  });

  it("should render grouped bars with a table fallback", () => {
    render(
      <BarChart
        labels={["Jan", "Feb"]}
        series={[
          { label: "Income", color: "red", values: [100, 200] },
          { label: "Expense", color: "blue", values: [50, 75] },
        ]}
        format={format}
        ariaLabel="Income and expense"
      />,
    );
    expect(screen.getByRole("img", { name: "Income and expense" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Data table"));
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("$2.00")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountInput } from "./AmountInput";

describe("AmountInput", () => {
  it("should commit a parsed amount on Enter", () => {
    const onCommit = vi.fn();
    render(
      <AmountInput
        valueMinor={0}
        currency="USD"
        scale={2}
        ariaLabel="Amount"
        onCommit={onCommit}
      />,
    );
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "12.34" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(1234);
  });

  it("should report a bad amount and keep the old value", () => {
    const onCommit = vi.fn();
    const onError = vi.fn();
    render(
      <AmountInput
        valueMinor={500}
        currency="USD"
        scale={2}
        ariaLabel="Amount"
        onCommit={onCommit}
        onError={onError}
      />,
    );
    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(input).toHaveValue("5.00");
  });
});

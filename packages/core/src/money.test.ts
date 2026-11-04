import { describe, expect, it } from "vitest";

import { formatMoneyPlain, parseMoney } from "./money";

function parse(value: string, currency = "USD", scale = 2): number {
  const result = parseMoney(value, currency, scale);
  if (result.isErr()) throw result.error;
  return result.value;
}

describe("parseMoney", () => {
  it("should read a plain decimal", () => {
    expect(parse("12.34")).toBe(1234);
    expect(parse("-12.34")).toBe(-1234);
    expect(parse("12")).toBe(1200);
  });

  it("should read thousands and decimal separators", () => {
    expect(parse("1,234.56")).toBe(123456);
    expect(parse("1.234,56")).toBe(123456);
    expect(parse("$1,234")).toBe(123400);
    expect(parse("12,50")).toBe(1250);
    expect(parse("1.234")).toBe(123);
  });

  it("should read parentheses as negative", () => {
    expect(parse("(12.00)")).toBe(-1200);
  });

  it("should round to the currency scale", () => {
    expect(parse("0.500")).toBe(50);
    expect(parse("1.005")).toBe(101);
  });

  it("should respect a three-decimal currency", () => {
    expect(parse("1,234", "KWD", 3)).toBe(1234000);
    expect(parse("1.234", "KWD", 3)).toBe(1234);
  });

  it("should reject empty and non-numeric input", () => {
    expect(parseMoney("", "USD").isErr()).toBe(true);
    expect(parseMoney("abc", "USD").isErr()).toBe(true);
  });

  it("should round-trip through the plain formatter", () => {
    for (const minor of [0, 1, 1234, -1234, 100000]) {
      expect(parse(formatMoneyPlain(minor, 2))).toBe(minor);
    }
  });
});

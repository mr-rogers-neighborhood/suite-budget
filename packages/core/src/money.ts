import { err, ok, type Result } from "neverthrow";

export type MoneyErrorCode = "empty" | "not-a-number" | "out-of-range";

export class MoneyError extends Error {
  constructor(
    readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

const scaleCache = new Map<string, number>();

/** The number of decimal places a currency normally uses, clamped to 0..3. */
export function currencyScale(currency: string): number {
  const cached = scaleCache.get(currency);
  if (cached !== undefined) return cached;
  let scale = 2;
  try {
    const options = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions();
    scale = options.maximumFractionDigits ?? 2;
  } catch {
    scale = 2;
  }
  const clamped = Math.min(3, Math.max(0, scale));
  scaleCache.set(currency, clamped);
  return clamped;
}

/**
 * Parses a human amount into signed minor units. Accepts `1,234.56`, `1.234,56`,
 * `(12.00)`, `-12`, and currency symbols. Exactly one separator is treated as the decimal
 * unless it splits three digits off a non-zero whole (`1,234` is 1234, `0.500` is 0.5).
 */
export function parseMoney(
  input: string,
  currency: string,
  scale: number = currencyScale(currency),
): Result<number, MoneyError> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return err(new MoneyError("empty", "Enter an amount"));

  const parenthesised = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  const negative = parenthesised || cleaned.startsWith("-");
  const unsigned = cleaned.replace(/-/g, "");
  if (unsigned.length === 0) {
    return err(new MoneyError("not-a-number", `"${input}" is not an amount`));
  }

  const lastDot = unsigned.lastIndexOf(".");
  const lastComma = unsigned.lastIndexOf(",");
  let decimalIndex = -1;
  let thousands = "";

  if (lastDot >= 0 && lastComma >= 0) {
    decimalIndex = Math.max(lastDot, lastComma);
    thousands = decimalIndex === lastDot ? "," : ".";
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? "." : ",";
    const index = lastDot >= 0 ? lastDot : lastComma;
    const occurrences = unsigned.split(separator).length - 1;
    const digitsAfter = unsigned.length - index - 1;
    const whole = unsigned.slice(0, index).replace(/^0+/, "");
    const wholeIsZero = whole === "" || whole === "0";
    // A single dot is a decimal separator. A single comma is a thousands separator only when
    // it splits exactly three digits off a non-zero whole in a two-decimal currency.
    const looksDecimal =
      occurrences === 1 && (separator === "." || !(digitsAfter === 3 && !wholeIsZero));
    if (looksDecimal) {
      decimalIndex = index;
    } else {
      thousands = separator;
    }
  }

  const withoutThousands = thousands ? unsigned.split(thousands).join("") : unsigned;
  const decimalPosition = thousands
    ? decimalIndex - countBefore(unsigned, thousands, decimalIndex)
    : decimalIndex;

  const wholePart =
    decimalPosition >= 0 ? withoutThousands.slice(0, decimalPosition) : withoutThousands;
  const fractionPart = decimalPosition >= 0 ? withoutThousands.slice(decimalPosition + 1) : "";
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionPart)) {
    return err(new MoneyError("not-a-number", `"${input}" is not an amount`));
  }

  const padded = fractionPart.padEnd(scale + 1, "0");
  const kept = padded.slice(0, scale);
  const next = padded.charAt(scale);
  const wholeDigits = wholePart.length > 0 ? wholePart : "0";

  try {
    let minor = BigInt(wholeDigits) * 10n ** BigInt(scale) + BigInt(kept.length > 0 ? kept : "0");
    if (next >= "5") minor += 1n;
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
      return err(new MoneyError("out-of-range", "That amount is too large"));
    }
    return ok(negative ? -Number(minor) : Number(minor));
  } catch {
    return err(new MoneyError("not-a-number", `"${input}" is not an amount`));
  }
}

function countBefore(value: string, needle: string, index: number): number {
  if (index < 0) return 0;
  let count = 0;
  for (let position = 0; position < index; position += 1) {
    if (value[position] === needle) count += 1;
  }
  return count;
}

export function formatMoney(
  minor: number,
  currency: string,
  locale: string | undefined = undefined,
  scale: number = currencyScale(currency),
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  });
  return formatter.format(minor / 10 ** scale);
}

export function formatMoneyPlain(minor: number, scale: number): string {
  const factor = 10 ** scale;
  const absolute = Math.abs(minor);
  const whole = Math.trunc(absolute / factor);
  const fraction = String(absolute % factor).padStart(scale, "0");
  const sign = minor < 0 ? "-" : "";
  return scale > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function percentOf(part: number, whole: number): number {
  if (whole === 0) return 0;
  return part / whole;
}

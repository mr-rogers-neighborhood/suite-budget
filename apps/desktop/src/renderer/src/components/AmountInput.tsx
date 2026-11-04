import { formatMoneyPlain, parseMoney } from "@suite/budget-core";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export type AmountInputProps = {
  valueMinor: number;
  currency: string;
  scale: number;
  ariaLabel: string;
  onCommit: (valueMinor: number) => void;
  onError?: (message: string) => void;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
  onNavigate?: (direction: "next" | "previous") => void;
};

export function AmountInput({
  valueMinor,
  currency,
  scale,
  ariaLabel,
  onCommit,
  onError,
  className,
  placeholder = "0.00",
  allowNegative = true,
  onNavigate,
}: AmountInputProps) {
  const [text, setText] = useState(() => formatMoneyPlain(valueMinor, scale));
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(formatMoneyPlain(valueMinor, scale));
  }, [valueMinor, scale, editing]);

  const commit = (): void => {
    setEditing(false);
    const parsed = parseMoney(text, currency, scale);
    if (parsed.isErr()) {
      setText(formatMoneyPlain(valueMinor, scale));
      onError?.(parsed.error.message);
      return;
    }
    if (!allowNegative && parsed.value < 0) {
      setText(formatMoneyPlain(valueMinor, scale));
      onError?.("Enter a positive amount");
      return;
    }
    if (parsed.value !== valueMinor) onCommit(parsed.value);
  };

  return (
    <input
      ref={input}
      aria-label={ariaLabel}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={(event) => {
        setEditing(true);
        event.currentTarget.select();
      }}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          onNavigate?.("next");
        } else if (event.key === "Escape") {
          event.preventDefault();
          setText(formatMoneyPlain(valueMinor, scale));
          setEditing(false);
          input.current?.blur();
        } else if (event.key === "ArrowDown" && onNavigate) {
          event.preventDefault();
          commit();
          onNavigate("next");
        } else if (event.key === "ArrowUp" && onNavigate) {
          event.preventDefault();
          commit();
          onNavigate("previous");
        }
      }}
      className={clsx(
        "tnum h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-right text-[13px] text-ink hover:border-line focus:border-accent focus:bg-raised focus:outline-none",
        className,
      )}
    />
  );
}

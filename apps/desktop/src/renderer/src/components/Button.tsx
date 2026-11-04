import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-[#07130d] hover:brightness-110 disabled:opacity-50",
  secondary: "border border-line bg-raised text-ink hover:border-faint disabled:opacity-50",
  ghost: "text-muted hover:bg-raised hover:text-ink disabled:opacity-50",
  danger: "border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-md px-2 text-[12px]",
  md: "h-9 gap-2 rounded-lg px-3 text-[13px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

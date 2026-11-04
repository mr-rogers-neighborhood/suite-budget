import type { InputHTMLAttributes, ReactNode } from "react";

export type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function Field({ label, hint, children, htmlFor }: FieldProps) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-8 w-full rounded-md border border-line bg-raised px-2.5 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

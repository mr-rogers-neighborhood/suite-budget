import { IconButton as SharedIconButton } from "@suite/ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
};

/**
 * A glyph button, on the shared one.
 *
 * This app passes its glyph as `icon=`; the shared component takes children. The wrapper is the
 * whole difference — the accessible name, the size, the hover state and the focus ring come from
 * `@suite/ui`, so there is one implementation to fix rather than two to keep in step.
 */
export function IconButton({ label, icon, ...props }: IconButtonProps) {
  return (
    <SharedIconButton label={label} {...props}>
      {icon}
    </SharedIconButton>
  );
}

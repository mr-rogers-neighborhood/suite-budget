import { useState } from "react";

import {
  readStoredTheme,
  setThemeChoice,
  type ThemeChoice,
  type ThemeMode,
  themeOptions,
} from "./theme";

/**
 * Theme and brightness, above the sidebar's file actions.
 *
 * Two questions in the order they are asked — a palette family, then how bright to draw it —
 * because "Solarized at night" is Solarized with dark values rather than a fifth entry in one
 * list. The same pair every other app in the suite offers.
 *
 * A `select` rather than a custom menu: this is one control in a footer, and the platform
 * control is the one that already works with a keyboard and a screen reader.
 */
const MODES: readonly { readonly value: ThemeMode; readonly label: string }[] = [
  { value: "system", label: "Follow the desktop" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readStoredTheme(window.localStorage));

  const apply = (next: ThemeChoice) => {
    setThemeChoice(next);
    setChoice(next);
  };

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[10px] text-faint">
        <span className="w-14 shrink-0">Theme</span>
        <select
          aria-label="Theme"
          value={choice.preset}
          onChange={(event) => apply({ ...choice, preset: event.target.value })}
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] text-ink"
        >
          {themeOptions().map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[10px] text-faint">
        <span className="w-14 shrink-0">Brightness</span>
        <select
          aria-label="Brightness"
          value={choice.mode}
          onChange={(event) => apply({ ...choice, mode: event.target.value as ThemeMode })}
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] text-ink"
        >
          {MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

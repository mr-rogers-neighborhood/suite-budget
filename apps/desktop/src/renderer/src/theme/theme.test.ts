import { DEFAULT_THEME_ID } from "@suite/theme";
import { describe, expect, it } from "vitest";
import { readStoredTheme, themeOptions } from "./theme";

describe("readStoredTheme", () => {
  it("follows the desktop with the default preset when nothing is stored", () => {
    expect(readStoredTheme({ getItem: () => null })).toEqual({
      preset: DEFAULT_THEME_ID,
      mode: "system",
    });
    expect(readStoredTheme(undefined)).toEqual({ preset: DEFAULT_THEME_ID, mode: "system" });
  });

  it("reads the pair a choice is stored as", () => {
    expect(
      readStoredTheme({ getItem: () => JSON.stringify({ preset: "solarized", mode: "dark" }) }),
    ).toEqual({ preset: "solarized", mode: "dark" });
  });

  it("keeps a mode written before presets existed", () => {
    expect(readStoredTheme({ getItem: () => "dark" })).toEqual({
      preset: DEFAULT_THEME_ID,
      mode: "dark",
    });
  });

  it("falls back for a preset this build does not ship", () => {
    expect(
      readStoredTheme({ getItem: () => JSON.stringify({ preset: "neon", mode: "light" }) }),
    ).toEqual({ preset: DEFAULT_THEME_ID, mode: "light" });
  });

  it("answers the default for a record it cannot parse", () => {
    expect(readStoredTheme({ getItem: () => "not json" })).toEqual({
      preset: DEFAULT_THEME_ID,
      mode: "system",
    });
  });
});

describe("themeOptions", () => {
  it("offers every preset the package ships, each with a name", () => {
    const options = themeOptions();
    expect(options[0]?.id).toBe(DEFAULT_THEME_ID);
    for (const option of options) expect(option.name.length).toBeGreaterThan(0);
  });
});

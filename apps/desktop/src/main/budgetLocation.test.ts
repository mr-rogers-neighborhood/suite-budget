import { describe, expect, it } from "vitest";

import { budgetFromArgv, budgetFromLink } from "./budgetLocation";

describe("budgetFromLink", () => {
  const folder = "/home/me/Documents/Suite/Budget";
  const present = () => true;

  it("resolves a link to the named budget in the library", () => {
    expect(budgetFromLink("suite://budget/workspace/2026.budget", folder, present)).toBe(
      `${folder}/2026.budget`,
    );
  });

  it("refuses a file that is not there", () => {
    expect(budgetFromLink("suite://budget/workspace/moved.budget", folder, () => false)).toBe(null);
  });

  it("refuses a name that is not a budget", () => {
    expect(budgetFromLink("suite://budget/workspace/notes.txt", folder, present)).toBeNull();
    expect(budgetFromLink("suite://budget/workspace/a/b.budget", folder, present)).toBeNull();
  });

  it("refuses a link that names another app", () => {
    expect(budgetFromLink("suite://planner/workspace/x.planner", folder, present)).toBeNull();
  });

  it("refuses a path, which is the other spelling it accepts", () => {
    expect(budgetFromLink("/tmp/x.budget", folder, present)).toBeNull();
  });
});

describe("budgetFromArgv", () => {
  const folder = "/home/me/Documents/Suite/Budget";
  const present = () => true;
  const argv = (...args: string[]) => ["/usr/bin/suite-budget", ...args];

  it("reads a path the desktop handed over", () => {
    expect(budgetFromArgv(argv("/tmp/x.budget"), folder, present)).toBe("/tmp/x.budget");
  });

  it("reads a link the hub routed here", () => {
    expect(budgetFromArgv(argv("suite://budget/workspace/2026.budget"), folder, present)).toBe(
      `${folder}/2026.budget`,
    );
  });

  it("never treats a link as a path", () => {
    // A link ends in `.budget` too, so the order of the two tests is the rule.
    expect(budgetFromArgv(argv("suite://budget/workspace/gone.budget"), folder, () => false)).toBe(
      null,
    );
  });
});

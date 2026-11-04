import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";

test("creates a budget, assigns a category, and restores it", async () => {
  const userData = await mkdtemp(join(tmpdir(), "suite-budget-e2e-"));

  const launch = () =>
    electron.launch({
      args: [process.cwd(), "--no-sandbox"],
      env: {
        ...process.env,
        SUITE_BUDGET_USER_DATA: userData,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
      },
    });

  const app = await launch();
  const page = await app.firstWindow();

  await page.getByRole("button", { name: "Start a budget" }).click();
  await page.getByLabel("Budget name").fill("E2E Budget");
  await page.getByLabel("Starting balance").fill("1000");
  await page.getByRole("button", { name: "Create budget" }).click();

  await expect(page.getByText("Ready to Assign").first()).toBeVisible();
  await expect(page.getByText("Rent / Mortgage")).toBeVisible();

  const assigned = page.getByLabel("Assigned to Rent / Mortgage");
  await assigned.fill("100");
  await assigned.press("Enter");
  await expect(assigned).toHaveValue("100.00");
  await expect(page.getByText("$100.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(page.locator('button[aria-current="true"]')).toHaveCount(1);
  await page.getByLabel("Payee").fill("Coffee");
  await page.getByLabel("Amount").fill("25");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Coffee")).toBeVisible();
  await expect(page.getByText("$25.00").first()).toBeVisible();

  await app.close();

  const relaunched = await launch();
  const restored = await relaunched.firstWindow();
  await restored.getByRole("button", { name: /E2E Budget\s+USD/ }).click();
  await expect(restored.getByText("Ready to Assign").first()).toBeVisible();
  await expect(restored.getByLabel("Assigned to Rent / Mortgage")).toHaveValue("100.00");
  await restored.getByRole("button", { name: "Accounts" }).click();
  await restored
    .getByRole("button", { name: /^Checking/ })
    .first()
    .click();
  await expect(restored.getByText("Coffee")).toBeVisible();
  await relaunched.close();
});

import { test, expect } from "@playwright/test";

test.describe("Web app smoke", () => {
  test("home redirects and loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(dashboard|sign-in)/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("sign-in page has accessible heading or form", async ({ page }) => {
    await page.goto("/sign-in");
    const heading = page.getByRole("heading", { level: 1 });
    const form = page.locator("form");
    await expect(heading.or(form).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard page loads without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    // Allow auth redirects - page should still load
    await page.waitForLoadState("networkidle");

    // Filter out expected auth-redirect errors
    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes("401") && !e.includes("auth") && !e.includes("Unauthorized"),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test("alerts page loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/alerts");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes("401") && !e.includes("auth") && !e.includes("Unauthorized"),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test("analytics page loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/analytics");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes("401") && !e.includes("auth") && !e.includes("Unauthorized"),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test("settings page loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/settings/user");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes("401") && !e.includes("auth") && !e.includes("Unauthorized"),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });

  test("playback page loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/playback");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes("401") && !e.includes("auth") && !e.includes("Unauthorized"),
    );
    expect(unexpectedErrors).toHaveLength(0);
  });
});

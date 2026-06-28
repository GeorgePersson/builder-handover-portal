import { expect, test } from "@playwright/test";

test.describe("core app smoke", () => {
  test("home page renders without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/Builder Handover Portal/);
    await expect(page.getByText("Builder Handover Platform")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Three separate portals for the product you are building" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("protected builder projects route either opens or redirects cleanly to login", async ({ page }) => {
    await page.goto("/builder/projects");

    if (page.url().includes("/login")) {
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email address" }).first()).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Password" }).first()).toBeVisible();
      expect(page.url()).toContain("next=%2Fbuilder%2Fprojects");
      return;
    }

    await expect(page.getByText(/Project browser|Handover Items|Projects/i).first()).toBeVisible();
  });

  test("client portal does not expose empty-field placeholders", async ({ page }) => {
    await page.goto("/client/portal");

    if (page.url().includes("/login")) {
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      return;
    }

    await expect(page.getByText("No location captured")).toHaveCount(0);
    await expect(page.getByText(/^undefined$/)).toHaveCount(0);
  });
});

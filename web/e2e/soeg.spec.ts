import { test, expect } from "@playwright/test";

test.describe("Søgeside", () => {
  test("viser søgeside", async ({ page }) => {
    await page.goto("/soeg");
    await expect(page.locator("h1")).toContainText(/søg shelters/i);
  });

  test("region Jylland viser kun Jylland-shelters i teksten", async ({ page }) => {
    await page.goto("/soeg?region=Jylland");
    // Dropdown skal vise Jylland
    await expect(page.getByLabel(/vælg region/i)).toHaveValue("Jylland");
    // Teksten skal indeholde "i Jylland" (ikke "i Danmark")
    const countText = page.locator("text=/\\d+ shelter[s]? i Jylland/");
    await expect(countText).toBeVisible({ timeout: 10000 });
  });

  test("kan skifte mellem liste, liste+kort og kort", async ({ page }) => {
    await page.goto("/soeg?region=Jylland");
    await page.getByRole("button", { name: /kun liste/i }).click();
    await expect(page).toHaveURL(/view=list/);
    await page.getByRole("button", { name: /liste og kort/i }).click();
    await expect(page).toHaveURL(/view=split/);
    await page.getByRole("button", { name: /kun kort/i }).click();
    await expect(page).toHaveURL(/view=map/);
  });
});

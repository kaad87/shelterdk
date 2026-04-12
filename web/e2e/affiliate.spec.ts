import { test, expect } from "@playwright/test";

test("/tilbud page renders with header and either products or empty state", async ({
  page,
}) => {
  await page.goto("/tilbud");
  await expect(page.locator("h1")).toContainText("Ugens bedste outdoor-tilbud");
  const emptyState = page.locator("text=Ingen tilbud lige nu");
  const cards = page.locator('a[rel="sponsored nofollow noopener"]');
  const empty = await emptyState.isVisible().catch(() => false);
  if (!empty) {
    await expect(cards.first()).toBeVisible();
  }
});

test("/annoncer-og-partnere loads and is linked from footer", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('footer a[href="/annoncer-og-partnere"]').click();
  await expect(page.locator("h1")).toContainText("Annoncer");
});

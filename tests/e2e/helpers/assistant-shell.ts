import { expect, type Page } from "@playwright/test";

async function expectSingleGlobalAccountEntry(page: Page) {
  const accountEntry = page.getByTestId("account-entry");
  await expect(accountEntry).toHaveCount(1);
  await expect(accountEntry).toBeVisible();
}

export async function expectAssistantFirstDesktopShell(
  page: Page,
  homeHref: "/assistant" | "/provider/assistant"
) {
  const rail = page.getByTestId("desktop-mission-rail");

  await expect(rail).toBeVisible();
  await expect(page.getByTestId("desktop-sidebar")).toHaveCount(0);
  await expect(page.getByTestId("mobile-navigation")).toHaveCount(0);
  await expect(rail.getByTestId("account-entry")).toHaveCount(0);
  await expectSingleGlobalAccountEntry(page);
  await expect(rail.getByTestId("new-mission-action")).toHaveAttribute(
    "href",
    homeHref
  );

  const box = await rail.boundingBox();
  expect(box, "Mission rail must have a measurable desktop box").not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(240);
  expect(box!.width).toBeLessThanOrEqual(264);
}

export async function expectAssistantFirstMobileShell(page: Page) {
  await expect(page.getByTestId("assistant-shell-mobile-header")).toBeVisible();
  await expect(page.getByTestId("assistant-shell-mobile-menu")).toBeVisible();
  await expect(page.getByTestId("mobile-navigation")).toHaveCount(0);
  await expect(page.getByTestId("desktop-mission-rail")).toBeHidden();
  await expectSingleGlobalAccountEntry(page);
}

export async function openAssistantFirstMobileDrawer(
  page: Page,
  homeHref: "/assistant" | "/provider/assistant"
) {
  await expectAssistantFirstMobileShell(page);
  await page.getByTestId("assistant-shell-mobile-menu").click();

  const dialog = page.getByRole("dialog", { name: "KLYX" });
  await expect(dialog).toBeVisible();
  const rail = dialog.getByTestId("mobile-mission-rail");
  await expect(rail).toBeVisible();
  await expect(rail.getByTestId("account-entry")).toHaveCount(0);
  await expect(dialog.getByTestId("new-mission-action")).toHaveAttribute(
    "href",
    homeHref
  );

  return dialog;
}

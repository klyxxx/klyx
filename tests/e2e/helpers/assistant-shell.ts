import { expect, type Page } from "@playwright/test";

type AssistantHomeHref = "/assistant" | "/provider/assistant";

function canonicalAssistantHomeHref(homeHref: AssistantHomeHref) {
  return homeHref === "/provider/assistant" ? "/assistant" : homeHref;
}

export async function expectAssistantFirstDesktopShell(
  page: Page,
  homeHref: AssistantHomeHref
) {
  const rail = page.getByTestId("desktop-mission-rail");

  await expect(rail).toBeVisible();
  await expect(page.getByTestId("desktop-sidebar")).toHaveCount(0);
  await expect(page.getByTestId("mobile-navigation")).toHaveCount(0);
  await expect(rail.getByTestId("new-mission-action")).toHaveAttribute(
    "href",
    canonicalAssistantHomeHref(homeHref)
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
}

export async function openAssistantFirstMobileDrawer(
  page: Page,
  homeHref: AssistantHomeHref
) {
  await expectAssistantFirstMobileShell(page);
  await page.getByTestId("assistant-shell-mobile-menu").click();

  const dialog = page.getByRole("dialog", { name: "KLYX" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("mobile-mission-rail")).toBeVisible();
  await expect(dialog.getByTestId("new-mission-action")).toHaveAttribute(
    "href",
    canonicalAssistantHomeHref(homeHref)
  );

  return dialog;
}

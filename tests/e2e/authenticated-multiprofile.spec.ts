import { expect, test, type Page } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
  readKlyxE2EProfiles,
} from "./helpers/authenticated-session";
import { expectAssistantFirstDesktopShell } from "./helpers/assistant-shell";

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function expectRolelessAccountMenu(page: Page) {
  await expectAssistantFirstDesktopShell(page, "/assistant");

  const rail = page.getByTestId("desktop-mission-rail");
  await expect(rail.getByTestId("account-switcher")).toHaveCount(0);

  const accountEntry = rail.getByTestId("account-entry");
  const trigger = accountEntry.getByTestId("mission-rail-account-entry");
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await trigger.click();

  const menu = accountEntry.getByTestId("account-menu-panel");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio")).toHaveCount(0);
  await expect(menu.locator('a[href="/profile"]')).toBeVisible();
  await expect(menu.locator('a[href="/settings"]')).toBeVisible();
  await expect(menu.locator('a[href="/support"]')).toBeVisible();
}

test.describe("KLYX authenticated compatibility profiles", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E session bootstrap is not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps legacy client/provider profiles behind one roleless account rail", async ({ page }) => {
    test.setTimeout(120_000);

    await loginKlyxE2E(page);

    const initial = await readKlyxE2EProfiles(page);
    const client = initial.profiles.find(
      (profile) => profile.accountType === "client"
    );
    const provider = initial.profiles.find(
      (profile) => profile.accountType === "provider"
    );

    expect(client, "Dedicated E2E client compatibility profile is missing.").toBeTruthy();
    expect(provider, "Dedicated E2E provider compatibility profile is missing.").toBeTruthy();

    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/assistant(?:\?|$)/);
    await expectRolelessAccountMenu(page);

    const clientState = await readKlyxE2EProfiles(page);
    expect(clientState.activeProfileId).toBe(client!.id);

    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/assistant(?:\?|$)/);
    await expectRolelessAccountMenu(page);

    const providerState = await readKlyxE2EProfiles(page);
    expect(providerState.activeProfileId).toBe(provider!.id);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/assistant(?:\?|$)/);
    await expectAssistantFirstDesktopShell(page, "/assistant");

    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant", { waitUntil: "domcontentloaded" });

    const restoredClientState = await readKlyxE2EProfiles(page);
    expect(restoredClientState.activeProfileId).toBe(client!.id);
    await expectAssistantFirstDesktopShell(page, "/assistant");
  });
});

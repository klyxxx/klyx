import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function openAccountSwitcher(
  page: Page,
  homeHref: "/assistant" | "/provider/assistant"
) {
  await expectAssistantFirstDesktopShell(page, homeHref);

  const slot = page.getByTestId("assistant-shell-account-slot");
  await expect(slot).toBeVisible();

  const switcher = slot.getByTestId("account-switcher");
  const accountEntry = switcher.getByTestId("account-entry");
  await expect(accountEntry).toBeVisible();
  await expect(accountEntry).toBeEnabled();
  await accountEntry.click();

  const panel = switcher.getByTestId("account-menu-panel");
  await expect(panel).toBeVisible();
  return switcher;
}

async function switchThroughUi(switcher: Locator) {
  const currentProfile = switcher.locator(
    '[role="menuitemradio"][aria-checked="true"]'
  );
  const targetProfile = switcher.locator(
    '[role="menuitemradio"][aria-checked="false"]'
  );

  await expect(currentProfile).toHaveCount(1);
  await expect(targetProfile).toHaveCount(1);
  await expect(currentProfile).toBeVisible();
  await expect(targetProfile).toBeVisible();
  await targetProfile.click();
}

test.describe("KLYX authenticated multi-profile", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E session bootstrap is not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("switch client/provider with a full role workspace reload", async ({ page }) => {
    test.setTimeout(120_000);

    await loginKlyxE2E(page);

    const initial = await readKlyxE2EProfiles(page);
    const client = initial.profiles.find(
      (profile) => profile.accountType === "client"
    );
    const provider = initial.profiles.find(
      (profile) => profile.accountType === "provider"
    );

    expect(client, "Dedicated E2E client profile is missing.").toBeTruthy();
    expect(provider, "Dedicated E2E provider profile is missing.").toBeTruthy();

    await activateKlyxE2EProfile(page, "client");
    await page.goto("/dashboard");
    await page.waitForURL((url) => url.pathname === "/assistant");
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();
    await expectAssistantFirstDesktopShell(page, "/assistant");

    await page.goto("/profile");
    const clientSwitcher = await openAccountSwitcher(page, "/assistant");
    await switchThroughUi(clientSwitcher);
    await page.waitForURL((url) => url.pathname === "/provider/assistant");
    await expectAssistantFirstDesktopShell(page, "/provider/assistant");
    await expect(
      page.getByRole("heading", { name: "Que dois-je préparer pour ton activité ?" })
    ).toBeVisible();

    const providerState = await readKlyxE2EProfiles(page);
    expect(providerState.activeProfileId).toBe(provider!.id);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/provider\/assistant(?:\?|$)/);
    await expectAssistantFirstDesktopShell(page, "/provider/assistant");

    await page.goto("/profile");
    const providerSwitcher = await openAccountSwitcher(
      page,
      "/provider/assistant"
    );
    await switchThroughUi(providerSwitcher);
    await page.waitForURL((url) => url.pathname === "/assistant");
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();
    await expectAssistantFirstDesktopShell(page, "/assistant");

    const clientState = await readKlyxE2EProfiles(page);
    expect(clientState.activeProfileId).toBe(client!.id);
  });
});

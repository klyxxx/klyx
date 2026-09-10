import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
  readKlyxE2EProfiles,
  type KlyxE2EProfile,
} from "./helpers/authenticated-session";
import { expectAssistantFirstDesktopShell } from "./helpers/assistant-shell";

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

function fullName(profile: KlyxE2EProfile) {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openAccountSwitcher(page: Page) {
  const rail = page.getByTestId("desktop-mission-rail");
  const accountEntry = rail.getByTestId("account-entry");
  await expect(accountEntry).toBeVisible();
  await accountEntry.click();

  const switcher = rail.getByTestId("account-switcher");
  await expect(switcher).toBeVisible();
  return switcher;
}

async function switchThroughUi(
  switcher: Locator,
  current: KlyxE2EProfile,
  target: KlyxE2EProfile
) {
  const currentPattern = new RegExp(escapeRegExp(fullName(current)), "i");
  const targetPattern = new RegExp(escapeRegExp(fullName(target)), "i");

  await switcher
    .getByRole("button", { name: currentPattern })
    .click();

  await switcher
    .getByRole("menuitem", { name: targetPattern })
    .click();
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
    const clientSwitcher = await openAccountSwitcher(page);
    await switchThroughUi(clientSwitcher, client!, provider!);
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
    const providerSwitcher = await openAccountSwitcher(page);
    await switchThroughUi(providerSwitcher, provider!, client!);
    await page.waitForURL((url) => url.pathname === "/assistant");
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();
    await expectAssistantFirstDesktopShell(page, "/assistant");

    const clientState = await readKlyxE2EProfiles(page);
    expect(clientState.activeProfileId).toBe(client!.id);
  });
});
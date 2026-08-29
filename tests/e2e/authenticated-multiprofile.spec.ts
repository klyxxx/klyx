import { expect, test, type Page } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
  readKlyxE2EProfiles,
  type KlyxE2EProfile,
} from "./helpers/authenticated-session";

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

async function switchThroughUi(
  page: Page,
  current: KlyxE2EProfile,
  target: KlyxE2EProfile
) {
  const currentPattern = new RegExp(escapeRegExp(fullName(current)), "i");
  const targetPattern = new RegExp(escapeRegExp(fullName(target)), "i");

  await page
    .getByRole("button", { name: currentPattern })
    .first()
    .click();

  await page
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
    await expect(page.getByText("Organise ton prochain besoin.")).toBeVisible();

    await switchThroughUi(page, client!, provider!);
    await page.waitForURL((url) => url.pathname === "/provider/jobs");
    await expect(
      page.getByRole("link", { name: "Missions", exact: true }).first()
    ).toBeVisible();

    const providerState = await readKlyxE2EProfiles(page);
    expect(providerState.activeProfileId).toBe(provider!.id);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/provider\/jobs(?:\?|$)/);
    await expect(
      page.getByRole("link", { name: "Services", exact: true }).first()
    ).toBeVisible();

    // The profile switcher currently lives on the dashboard header. Returning
    // there is intentional; the next switch must still replace the complete
    // document with the client KLYX workspace.
    await page.goto("/dashboard");
    await switchThroughUi(page, provider!, client!);
    await page.waitForURL((url) => url.pathname === "/assistant");
    await expect(
      page.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();

    const clientState = await readKlyxE2EProfiles(page);
    expect(clientState.activeProfileId).toBe(client!.id);
  });
});

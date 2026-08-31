import { expect, test } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX strict role navigation", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("client desktop exposes exactly KLYX, Activité, Messages and Profil", async ({
    page,
  }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant");

    const navigation = page.getByRole("navigation", {
      name: "Navigation principale KLYX",
    });

    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).toHaveCount(4);

    for (const label of ["KLYX", "Activité", "Messages", "Profil"] as const) {
      await expect(
        navigation.getByRole("link", { name: label, exact: true })
      ).toBeVisible();
    }

    await expect(navigation.getByText("Missions", { exact: true })).toHaveCount(0);
    await expect(navigation.getByText("Gestion", { exact: true })).toHaveCount(0);
  });

  test("provider desktop exposes exactly Missions, Services, Finances and Profil", async ({
    page,
  }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");
    await page.goto("/provider/assistant");

    const navigation = page.getByRole("navigation", {
      name: "Navigation principale KLYX",
    });

    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).toHaveCount(4);

    for (const label of ["Missions", "Services", "Finances", "Profil"] as const) {
      await expect(
        navigation.getByRole("link", { name: label, exact: true })
      ).toBeVisible();
    }

    await expect(navigation.getByText("KLYX", { exact: true })).toHaveCount(0);
    await expect(navigation.getByText("Messages", { exact: true })).toHaveCount(0);
    await expect(navigation.getByText("Gestion", { exact: true })).toHaveCount(0);

    await expect(
      navigation.getByRole("link", { name: "Missions", exact: true })
    ).toHaveAttribute("href", "/provider/jobs");
    await expect(
      navigation.getByRole("link", { name: "Services", exact: true })
    ).toHaveAttribute("href", "/provider/studio");
    await expect(
      navigation.getByRole("link", { name: "Finances", exact: true })
    ).toHaveAttribute("href", "/provider/payments");
    await expect(
      navigation.getByRole("link", { name: "Profil", exact: true })
    ).toHaveAttribute("href", "/profile");
  });

  test("mobile uses a four-entry bottom bar with touch-friendly targets", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");
    await page.goto("/assistant");

    const navigation = page.getByRole("navigation", {
      name: "Navigation mobile KLYX",
    });
    const links = navigation.getByRole("link");

    await expect(navigation).toBeVisible();
    await expect(links).toHaveCount(4);

    for (let index = 0; index < 4; index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

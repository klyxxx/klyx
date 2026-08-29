import { expect, type Page } from "@playwright/test";

export const e2eEmail = process.env.KLYX_E2E_EMAIL?.trim();
export const e2ePassword = process.env.KLYX_E2E_PASSWORD;

export const hasE2ECredentials = Boolean(e2eEmail && e2ePassword);

export type KlyxE2EProfile = {
  id: string;
  firstName: string;
  lastName: string;
  accountType: "client" | "provider";
};

type ProfilesState = {
  profiles: KlyxE2EProfile[];
  activeProfileId: string | null;
};

export async function clearSensitivePassword(page: Page) {
  try {
    await page.locator('input[type="password"]').evaluateAll((inputs) => {
      for (const input of inputs) {
        const element = input as HTMLInputElement;
        element.value = "";
        element.removeAttribute("value");
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  } catch {
    // The password field can already be gone after navigation.
  }
}

export async function loginKlyxE2E(page: Page) {
  if (!e2eEmail || !e2ePassword) {
    throw new Error("Dedicated KLYX E2E credentials are not configured.");
  }

  await page.goto("/login");

  const emailInput = page.getByPlaceholder("vous@exemple.com");
  const loginState = await Promise.race([
    page
      .waitForURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 })
      .then(() => "authenticated" as const),
    emailInput
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => "login" as const),
  ]);

  // Shared authenticated projects already carry a Supabase browser session.
  // In that case /login redirects to /dashboard and no password request is made.
  if (loginState === "authenticated") {
    return;
  }

  await emailInput.fill(e2eEmail);
  await page.getByPlaceholder("Votre mot de passe").fill(e2ePassword);

  try {
    await page.getByRole("button", { name: "Se connecter" }).click();
  } finally {
    await clearSensitivePassword(page);
  }

  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 20_000 });
}

export async function readKlyxE2EProfiles(page: Page): Promise<ProfilesState> {
  return page.evaluate(async () => {
    const response = await fetch("/api/profiles/active", {
      cache: "no-store",
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Profiles API failed.");
    }

    return body;
  });
}

export async function activateKlyxE2EProfile(
  page: Page,
  accountType: "client" | "provider"
) {
  const state = await readKlyxE2EProfiles(page);
  const profile = state.profiles.find((item) => item.accountType === accountType);

  expect(profile, `Dedicated E2E ${accountType} profile is missing.`).toBeTruthy();

  if (state.activeProfileId !== profile!.id) {
    await page.evaluate(async (profileId) => {
      const response = await fetch("/api/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Profile switch failed.");
      }
    }, profile!.id);
  }

  return profile!;
}

export async function expectHealthyPrivateRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });

  expect(response, `${route} did not return a document response`).toBeTruthy();
  expect(response!.status(), `${route} returned an HTTP error`).toBeLessThan(400);

  const current = new URL(page.url());
  expect(current.pathname, `${route} bounced to login`).not.toBe("/login");
  expect(
    current.pathname === route || current.pathname.startsWith(`${route}/`),
    `${route} unexpectedly navigated to ${current.pathname}`
  ).toBe(true);
}

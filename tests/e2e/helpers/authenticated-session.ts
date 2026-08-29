import { expect, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const e2eEmail = process.env.KLYX_E2E_EMAIL?.trim();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const sessionBootstrapEnabled =
  process.env.KLYX_E2E_SESSION_BOOTSTRAP === "1";

export const hasE2ECredentials = Boolean(
  sessionBootstrapEnabled &&
    e2eEmail &&
    supabaseUrl &&
    supabasePublicKey &&
    supabaseServiceRoleKey
);

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

type SessionCookie = {
  name: string;
  value: string;
};

const USERS_PAGE_SIZE = 1000;
const MAX_USER_PAGES = 100;

async function createVerifiedE2EAdminClient() {
  if (!e2eEmail || !supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Dedicated KLYX E2E admin bootstrap is not configured."
    );
  }

  const admin = createSupabaseClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
  const normalizedEmail = e2eEmail.toLowerCase();

  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Unable to read dedicated E2E user: ${error.message}`);
    }

    const existing = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (existing) return admin;

    if (data.users.length < USERS_PAGE_SIZE) break;
  }

  throw new Error(
    "Dedicated KLYX E2E user does not already exist; refusing admin magic-link bootstrap."
  );
}

async function createAuthenticatedSessionCookies(): Promise<SessionCookie[]> {
  if (
    !hasE2ECredentials ||
    !e2eEmail ||
    !supabaseUrl ||
    !supabasePublicKey ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Dedicated KLYX E2E session bootstrap is not configured."
    );
  }

  /*
   * Turnstile is intentionally enforced by production Supabase Auth.
   * The protected E2E suite must therefore never weaken CAPTCHA or expose
   * a public bypass route. Instead, the Node-only test process uses the
   * already-required service-role secret to generate a one-time magic-link
   * token for the pre-existing dedicated E2E account, then verifies that
   * token through the normal public Auth API and lets @supabase/ssr produce
   * the exact session cookies consumed by KLYX middleware/server clients.
   */
  const admin = await createVerifiedE2EAdminClient();

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: e2eEmail,
    });

  if (linkError) {
    throw new Error(
      `Unable to generate dedicated E2E magic link: ${linkError.message}`
    );
  }

  const tokenHash = linkData.properties?.hashed_token?.trim();

  if (!tokenHash) {
    throw new Error("Dedicated E2E magic link did not return a token hash.");
  }

  let cookiesToSet: SessionCookie[] = [];

  const authClient = createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(nextCookies) {
          cookiesToSet = nextCookies.map(({ name, value }) => ({
            name,
            value,
          }));
        },
      },
    }
  );

  const { data: verified, error: verifyError } =
    await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });

  if (verifyError || !verified.session || !verified.user) {
    throw new Error(
      `Unable to verify dedicated E2E magic link: ${
        verifyError?.message ?? "session missing"
      }`
    );
  }

  if (
    verified.user.email?.trim().toLowerCase() !== e2eEmail.toLowerCase()
  ) {
    throw new Error("Dedicated E2E bootstrap resolved an unexpected user.");
  }

  if (cookiesToSet.length === 0) {
    throw new Error("Supabase SSR did not emit authenticated session cookies.");
  }

  return cookiesToSet;
}

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
  if (!hasE2ECredentials) {
    throw new Error(
      "Dedicated KLYX E2E session bootstrap is not configured."
    );
  }

  /* Resolve the actual Playwright origin before attaching SSR cookies. */
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const origin = new URL(page.url()).origin;
  const sessionCookies = await createAuthenticatedSessionCookies();

  await page.context().addCookies(
    sessionCookies.map(({ name, value }) => ({
      name,
      value,
      url: origin,
    }))
  );

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
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

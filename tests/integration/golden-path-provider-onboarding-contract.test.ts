import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");
const onboarding = readRepoFile("scripts/golden-path-provider-onboarding.mjs");

describe("KLYX provider onboarding golden path", () => {
  it("keeps the provider onboarding proof syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-provider-onboarding.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs provider onboarding after the production server starts and before client search", () => {
    const startServer = "Start golden path production server";
    const providerOnboarding = "node scripts/golden-path-provider-onboarding.mjs";
    const clientSearch = "node scripts/golden-path-intent-search.mjs";

    expect(workflow).toContain(providerOnboarding);
    expect(workflow.indexOf(startServer)).toBeLessThan(
      workflow.indexOf(providerOnboarding)
    );
    expect(workflow.indexOf(providerOnboarding)).toBeLessThan(
      workflow.indexOf(clientSearch)
    );
  });

  it("gates provider studio, zones and their session dependencies", () => {
    for (const criticalPath of [
      '"app/api/provider/studio/**"',
      '"app/api/provider/zones/**"',
      '"lib/provider-studio.ts"',
      '"lib/active-profile.ts"',
      '"lib/supabase/server.ts"',
    ]) {
      expect(workflow).toContain(criticalPath);
    }
  });

  it("uses a real Supabase SSR session and the active provider profile", () => {
    expect(onboarding).toContain('import { createServerClient } from "@supabase/ssr"');
    expect(onboarding).toContain("signInWithPassword({ email, password })");
    expect(onboarding).toContain("Supabase SSR sign-in did not produce auth cookies.");
    expect(onboarding).toContain("ACTIVE_PROFILE_COOKIE");
    expect(onboarding).toContain("Cookie: cookieHeader");
  });

  it("configures the provider through the real studio and zones APIs", () => {
    expect(onboarding).toContain('fetch(`${appOrigin}/api/provider/studio`');
    expect(onboarding).toContain('method: "PUT"');
    expect(onboarding).toContain('fetch(`${appOrigin}/api/provider/zones`');
    expect(onboarding).toContain('method: "POST"');
    expect(onboarding).toContain('publish: true');
    expect(onboarding).toContain('pricingType: "hourly"');
    expect(onboarding).toContain('hourlyPrice: 35');
    expect(onboarding).toContain('locality: "Bruxelles"');
    expect(onboarding).toContain('postalCode: "1000"');
    expect(onboarding).toContain('radiusKm: 30');
  });

  it("forces the APIs to recreate the service profile, availability and zone", () => {
    expect(onboarding).toContain('.from("provider_service_zones")');
    expect(onboarding).toContain('.from("availability_slots")');
    expect(onboarding).toContain('.from("service_profiles")');
    expect(onboarding).toContain('.update({ active: false, provider_enabled: false })');
    expect(onboarding).toContain('.update({ is_published: false, updated_at: now })');
    expect(onboarding).toContain("Provider studio must reactivate the canonical user_service.");
  });

  it("verifies persisted publication, tariff, availability and Brussels zone", () => {
    expect(onboarding).toContain('persistedProviderProfile.is_published === true');
    expect(onboarding).toContain('persistedProviderProfile.verification_status === "verified"');
    expect(onboarding).toContain('persistedServiceProfile.pricing_type === "hourly"');
    expect(onboarding).toContain('Number(persistedServiceProfile.hourly_price) === 35');
    expect(onboarding).toContain('(persistedAvailability ?? []).length === 7');
    expect(onboarding).toContain('persistedZone.country_code === "BE"');
    expect(onboarding).toContain('persistedZone.locality === "Bruxelles"');
    expect(onboarding).toContain('persistedZone.postal_code === "1000"');
  });

  it("stays isolated and makes no Stripe Connect or payout claim", () => {
    expect(onboarding).toContain("assertGoldenPathIsolation");
    expect(onboarding).toContain('appOrigin === "http://127.0.0.1:3100"');
    expect(onboarding).toContain("stripeConnectNetworkClaimed: false");
    expect(onboarding).toContain("payoutClaimed: false");
    expect(onboarding).not.toContain("api.stripe.com");
    expect(onboarding).not.toContain("sk_live_");
  });
});

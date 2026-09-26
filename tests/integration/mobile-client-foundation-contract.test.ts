import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("KLYX mobile client foundation contract", () => {
  it("keeps mobile as a client of the existing KLYX Core", () => {
    const architecture = read("docs/KLYX_MOBILE_ARCHITECTURE.md");
    expect(architecture).toContain("This is a transport adapter, not a second backend.");
    expect(architecture).toContain("Economic Eligibility");
    expect(architecture).toContain("canonical ledger");
  });

  it("bridges Supabase mobile auth into the existing secure cookie session", () => {
    const route = read("app/api/mobile/session/route.ts");
    const client = read("mobile/src/lib/klyx-api.ts");
    expect(route).toContain("supabase.auth.setSession");
    expect(route).toContain("supabase.auth.signOut");
    expect(client).toContain("/api/mobile/session");
    expect(client).toContain('credentials: "include"');
    expect(client).toContain("Authorization: `Bearer ${accessToken}`");
    expect(client).toContain("clearWebSession");
  });

  it("uses a bearer-native owned-profile projection instead of trusting device state", () => {
    const route = read("app/api/mobile/profiles/route.ts");
    const client = read("mobile/src/lib/klyx-api.ts");
    const serverAuth = read("lib/api-auth.ts");
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain("profiles.find((item) => item.id === profileId)");
    expect(client).toContain("/api/mobile/profiles");
    expect(client).toContain("x-klyx-active-profile-id");
    expect(client).toContain("expo-secure-store");
    expect(serverAuth).toContain('const ACTIVE_PROFILE_HEADER = "x-klyx-active-profile-id"');
    expect(serverAuth).toContain("request.headers");
    expect(serverAuth).toContain("normalizedProfiles.some((profile) => profile.id === requestedProfileId)");
    expect(serverAuth).toContain('throw new Error("KLYX_ACTIVE_PROFILE_NOT_OWNED")');
    expect(serverAuth).toContain('message === "KLYX_ACTIVE_PROFILE_NOT_OWNED"');
  });

  it("stores native auth state only in encrypted chunked device storage", () => {
    const supabase = read("mobile/src/lib/supabase.ts");
    expect(supabase).toContain("expo-secure-store");
    expect(supabase).toContain("WHEN_UNLOCKED_THIS_DEVICE_ONLY");
    expect(supabase).toContain("CHUNK_SIZE");
    expect(supabase).toContain("startAutoRefresh");
    expect(supabase).toContain("stopAutoRefresh");
    expect(supabase).not.toContain("AsyncStorage");
    expect(supabase).not.toContain("localStorage");
  });

  it("does not place authoritative provider secrets in mobile configuration", () => {
    const env = read("mobile/.env.example");
    const config = read("mobile/src/config.ts");
    for (const forbidden of [
      "SUPABASE_SERVICE_ROLE_KEY=",
      "STRIPE_SECRET_KEY=",
      "SUMSUB_SECRET_KEY=",
      "TWILIO_AUTH_TOKEN=",
      "RESEND_API_KEY=",
      "OPENAI_API_KEY=",
    ]) {
      expect(env).not.toContain(forbidden);
      expect(config).not.toContain(forbidden);
    }
  });

  it("keeps financial authority out of the mobile payment adapter", () => {
    const payments = read("mobile/src/lib/payments.ts");
    expect(payments).toContain("Mobile never computes amount");
    expect(payments).not.toContain("STRIPE_SECRET_KEY");
    expect(payments).not.toContain("transfers.create");
    expect(payments).not.toContain("refunds.create");
  });

  it("uses server-authoritative economic eligibility and canonical ledger views", () => {
    const api = read("mobile/src/lib/klyx-api.ts");
    const earn = read("mobile/app/(tabs)/earn.tsx");
    expect(api).toContain('"/api/provider/jobs"');
    expect(api).toContain('"/api/provider/finance"');
    expect(earn).toContain("loadProviderOpportunities");
    expect(earn).toContain("loadProviderFinance");
    expect(earn).toContain("Le mobile n’autorise ni transfert, ni settlement, ni correction du ledger");
    expect(earn).not.toContain("transfers.create");
    expect(earn).not.toContain("booking_financial_ledger");
  });

  it("uses the same KLYX assistant and Sumsub engines as web", () => {
    const api = read("mobile/src/lib/klyx-api.ts");
    const sumsub = read("mobile/src/lib/sumsub.ts");
    expect(api).toContain("/api/brain/respond");
    expect(sumsub).toContain("/api/provider/sumsub/token");
    expect(sumsub).toContain("SNSMobileSDK.init");
    expect(sumsub).not.toContain("SUMSUB_SECRET_KEY");
  });
});

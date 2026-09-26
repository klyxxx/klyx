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
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain("profiles.find((item) => item.id === profileId)");
    expect(client).toContain("/api/mobile/profiles");
    expect(client).toContain("x-klyx-active-profile-id");
    expect(client).toContain("expo-secure-store");
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

  it("uses the same KLYX assistant engine as web", () => {
    const api = read("mobile/src/lib/klyx-api.ts");
    expect(api).toContain("/api/brain/respond");
  });
});

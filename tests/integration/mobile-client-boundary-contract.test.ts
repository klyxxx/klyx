import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function collectSourceFiles(root: string): string[] {
  const absolute = path.join(process.cwd(), root);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relative);
    return /\.(?:ts|tsx|js)$/.test(entry.name) ? [relative] : [];
  });
}

describe("KLYX mobile client boundary", () => {
  it("keeps server secrets and financial authority out of mobile source", () => {
    const mobileSource = collectSourceFiles("mobile/src")
      .concat(["mobile/App.tsx", "mobile/app.config.js"])
      .map(read)
      .join("\n");

    for (const forbidden of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "SUMSUB_SECRET_KEY",
      "TWILIO_AUTH_TOKEN",
      "RESEND_API_KEY",
      "OPENAI_API_KEY",
      "evaluateEconomicEligibility(",
      "stripe.transfers.create(",
      "stripe.refunds.create(",
      "stripe.payouts.create(",
    ]) {
      expect(mobileSource).not.toContain(forbidden);
    }

    const packageJson = JSON.parse(read("mobile/package.json")) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.stripe).toBeUndefined();
    expect(packageJson.dependencies?.["@stripe/stripe-react-native"]).toBeUndefined();
  });

  it("routes sensitive engines through existing KLYX Core APIs", () => {
    const core = read("mobile/src/klyx-core.ts");

    expect(core).toContain('"/api/assistant/unified"');
    expect(core).toContain('"/api/stripe/create-checkout-session"');
    expect(core).toContain('"/api/provider/sumsub/token"');
    expect(core).toContain('"/api/provider/sumsub/status"');
    expect(core).toContain('"/api/provider/finance"');
    expect(core).toContain('"/api/mobile/notifications/read"');
    expect(core).toContain("Authorization: `Bearer ${session.access_token}`");
  });

  it("keeps mobile notification mutations profile-owner scoped", () => {
    const route = read("app/api/mobile/notifications/read/route.ts");

    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain("profiles.some((item) => item.id === profileId)");
    expect(route).toContain('.eq("user_id", profileId)');
  });

  it("uses backend-issued short-lived Sumsub tokens", () => {
    const sumsub = read("mobile/src/sumsub.ts");
    const tokenRoute = read("app/api/provider/sumsub/token/route.ts");

    expect(sumsub).toContain("createSumsubSdkToken()");
    expect(sumsub).toContain("SNSMobileSDK.init(initial.token");
    expect(tokenRoute).toContain("identityVerification.createSdkToken");
  });

  it("synchronizes mobile translations from the existing Tolgee snapshots", () => {
    const sync = read("mobile/scripts/sync-tolgee.mjs");
    expect(sync).toContain('"messages", "tolgee"');
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX provider onboarding progress page-i18n integration", () => {
  it("wires provider progress presentation to page translations", () => {
    const source = read("app/onboarding/ProviderOnboardingProgress.tsx");

    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxProviderProgress");
    expect(source).toContain("formatKlyxProviderProgress");
    expect(source).toContain("KLYX_PROVIDER_PROGRESS_I18N_16_03");
  });

  it("preserves all four provider readiness sources", () => {
    const source = read("app/onboarding/ProviderOnboardingProgress.tsx");

    for (const route of [
      "/api/provider/studio",
      "/api/provider/zones",
      "/api/provider/verification",
      "/api/stripe/connect/status",
    ]) {
      expect(source).toContain(route);
    }
  });

  it("keeps live payment completion fail-closed and verification optional", () => {
    const source = read("app/onboarding/ProviderOnboardingProgress.tsx");

    expect(source).toMatch(/const stripeDone\s*=\s*Boolean\(stripe\?\.livePaymentsOperational\)/);
    expect(source).toMatch(/stripe\?\.paymentBlockReason/);
    expect(source).toMatch(/translateKlyxProviderPaymentReadiness/);
    expect(source).toMatch(/id:\s*["']verification["'][\s\S]*required:\s*false/);
    expect(source).toMatch(/id:\s*["']payments["'][\s\S]*required:\s*true/);
    expect(source).not.toMatch(
      /const stripeDone\s*=\s*Boolean\([\s\S]*stripe\?\.connected\s*&&\s*stripe\.onboardingComplete\s*&&\s*stripe\.chargesEnabled\s*&&\s*stripe\.payoutsEnabled/
    );
  });

  it("does not surface API response error strings directly", () => {
    const source = read("app/onboarding/ProviderOnboardingProgress.tsx");

    expect(source).not.toContain("studioBody.error ||");
    expect(source).not.toContain("zonesBody.error ||");
    expect(source).not.toContain("verificationBody.error ||");
  });
});

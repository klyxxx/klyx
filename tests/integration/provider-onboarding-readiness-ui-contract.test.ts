import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/onboarding/ProviderOnboardingProgress.tsx"),
  "utf8"
);

describe("KLYX provider onboarding readiness UI contract", () => {
  it("reads all four existing provider readiness sources", () => {
    for (const route of [
      "/api/provider/studio",
      "/api/provider/zones",
      "/api/provider/verification",
      "/api/stripe/connect/status",
    ]) {
      expect(source).toContain(route);
    }
  });

  it("keeps profile, service, price, availability and zone readiness semantics", () => {
    expect(source).toMatch(/headline[\s\S]*trim\(\)\.length\s*>=\s*5/);
    expect(source).toMatch(/bio[\s\S]*trim\(\)\.length\s*>=\s*30/);
    expect(source).toMatch(/enabledServices\.length\s*>\s*0/);
    expect(source).toMatch(/Number\(price\)\s*>=\s*0/);
    expect(source).toMatch(/day\.enabled\s*===\s*true/);
    expect(source).toMatch(/zone\.is_active\s*!==\s*false/);
  });

  it("keeps verification and Stripe completion fail-closed", () => {
    expect(source).toContain('["approved", "verified"].includes(verificationStatus)');
    for (const status of ["incomplete", "submitted", "under_review", "pending"]) {
      expect(source).toContain(`"${status}"`);
    }
    expect(source).toMatch(/stripe\?\.connected[\s\S]*stripe\.onboardingComplete[\s\S]*stripe\.chargesEnabled[\s\S]*stripe\.payoutsEnabled/);
  });

  it("keeps readiness based only on all required steps being done", () => {
    expect(source).toMatch(/requiredSteps\s*=\s*steps\.filter\(\(step\)\s*=>\s*step\.required\)/);
    expect(source).toMatch(/completedRequired\s*=\s*requiredSteps\.filter\(\(step\)\s*=>\s*step\.state\s*===\s*["']done["']\)\.length/);
    expect(source).toMatch(/requiredSteps\.length\s*>\s*0\s*&&\s*completedRequired\s*===\s*requiredSteps\.length/);
  });
});

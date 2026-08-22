import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const readinessSource = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-market-readiness.ts"),
  "utf8"
);

const documentation = fs.readFileSync(
  path.join(process.cwd(), "docs/KLYX_MARKET_READINESS.md"),
  "utf8"
);

describe("KLYX market readiness governance contract", () => {
  it("separates monetary capability from commercial readiness", () => {
    expect(readinessSource).toContain("KLYX_SUPPORTED_MARKETS");
    expect(readinessSource).toContain("monetarySupport");
    expect(readinessSource).toContain("isKlyxMarketCommerciallyReady");
    expect(documentation).toContain("monetary capability catalogue");
    expect(documentation).toContain("Currency support alone never produces `ready=true`");
  });

  it("requires the four launch-readiness dimensions and explicit launch decision", () => {
    for (const marker of [
      "stripeConnect",
      "kyc",
      "tax",
      "regulatedCategories",
      "launchDecision",
    ]) {
      expect(readinessSource).toContain(marker);
    }

    expect(readinessSource).toContain('status: "unverified"');
    expect(readinessSource).toContain('status: "closed"');
    expect(readinessSource).toContain('decision.status === "open"');
  });

  it("requires dated evidence rather than unsupported launch claims", () => {
    expect(readinessSource).toContain("verifiedAt?.trim()");
    expect(readinessSource).toContain("sourceRef?.trim()");
    expect(readinessSource).toContain("decidedAt?.trim()");
    expect(readinessSource).toContain("evidenceRef?.trim()");
    expect(documentation).toContain("dated and referenced");
  });

  it("has no provider or database side effects", () => {
    expect(readinessSource).not.toMatch(/fetch\s*\(/);
    expect(readinessSource).not.toContain("@/lib/supabase");
    expect(readinessSource).not.toContain("stripe.");
    expect(readinessSource).not.toContain("new Stripe");
    expect(readinessSource).not.toContain("process.env");
  });

  it("documents that readiness is governance rather than legal advice", () => {
    expect(documentation).toContain("does not replace jurisdiction-specific legal, tax or regulatory advice");
    expect(documentation).toContain("Do not paste secrets");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/ProviderReadinessStatus.tsx"),
  "utf8"
);

describe("KLYX provider readiness safety and i18n contract", () => {
  it("keeps readiness loading strictly read-only", () => {
    expect(source).toContain('fetch("/api/provider/studio"');
    expect(source).toContain('fetch("/api/provider/zones"');
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
  });

  it("preserves the exact provider readiness criteria", () => {
    expect(source).toContain("service.enabled &&");
    expect(source).toContain('(service.title ?? "").trim().length >= 5');
    expect(source).toContain('(service.description ?? "").trim().length >= 30');
    expect(source).toContain("service.price !== null &&");
    expect(source).toContain("service.price !== undefined &&");
    expect(source).toContain('(service.city ?? "").trim().length > 0');
    expect(source).toContain("service.serviceArea.length > 0 &&");
    expect(source).toContain("service.availability.some((day) => day.enabled)");
    expect(source).toContain("zone.is_active !== false");
    expect(source).toContain("studio?.providerProfile?.isPublished === true");
    expect(source).toContain(
      'studio?.providerProfile?.verificationStatus === "verified"'
    );
    expect(source).toContain("const mandatoryItems = items.slice(0, 3);");
  });

  it("keeps refresh explicit and does not add polling or retries", () => {
    expect(source).toContain("onClick={() => void load(true)}");
    expect(source).toContain("void load(false);");
    expect(source).not.toContain("setInterval(");
    expect(source).not.toContain("setTimeout(");
  });

  it("preserves all readiness destinations", () => {
    expect(source).toContain('href: "/provider"');
    expect(source).toContain('href: "/provider/zones"');
    expect(source).toContain('href: "/provider/verification"');
    expect(source).toContain('href="/onboarding"');
  });

  it("localizes presentation without reflecting backend or network errors", () => {
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("translateKlyxProviderReadiness(locale, key)");
    expect(source).toContain('t("genericError")');
    expect(source).not.toContain("body.error");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("studioBody.error");
    expect(source).not.toContain("zonesBody.error");
  });
});

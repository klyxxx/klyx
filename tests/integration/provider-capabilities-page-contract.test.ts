import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "app/provider/capabilities/page.tsx"),
  "utf8"
);
const providerHome = readFileSync(
  join(process.cwd(), "app/provider/page.tsx"),
  "utf8"
);
const entry = readFileSync(
  join(process.cwd(), "app/components/ProviderCapabilitiesEntry.tsx"),
  "utf8"
);

describe("provider capabilities page contract", () => {
  it("uses only owner-scoped provider APIs for capabilities and offer links", () => {
    expect(page).toContain('fetch("/api/provider/capabilities"');
    expect(page).toContain('fetch("/api/provider/capability-links"');
    expect(page).toContain('fetch("/api/provider/studio"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).not.toContain("supabase.from(");
  });

  it("supports explicit declare, edit, confirm, archive, restore, link and unlink actions", () => {
    expect(page).toContain('method: "POST"');
    expect(page).toContain('method: "PATCH"');
    expect(page).toContain('const draft = capability.status === "draft"');
    expect(page).toContain('const nextStatus = draft || restoring ? "confirmed" : "archived"');
    expect(page).toContain('method: existing ? "DELETE" : "POST"');
    expect(page).toContain("capabilityId, userServiceId");
  });

  it("does not couple free-form capabilities to profession proposals or document verification", () => {
    expect(page).not.toContain("/api/provider/service-proposals");
    expect(page).not.toContain("/api/provider/skills-verification");
    expect(page).not.toContain("/api/provider/skill-requirements");
    expect(page).not.toContain("provider_skill_verifications");
    expect(page).not.toContain("skill_qualification_rules");
  });

  it("does not reflect raw backend error strings into the UI", () => {
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("result.error");
    expect(page).not.toContain("error.message");
    expect(page).toContain('t("loadError")');
    expect(page).toContain('t("saveError")');
  });

  it("keeps offer linking descriptive and leaves publication to provider studio", () => {
    expect(page).toContain("service.enabled === true");
    expect(page).toContain("service.userServiceId");
    expect(page).not.toContain("publish:");
    expect(page).not.toContain("isPublished");
    expect(page).not.toContain("provider_enabled:");
  });

  it("exposes the dedicated capability page from provider home", () => {
    expect(providerHome).toContain("ProviderCapabilitiesEntry");
    expect(entry).toContain('href="/provider/capabilities"');
    expect(entry).toContain("translateKlyxProviderCapabilitiesPage");
  });
});

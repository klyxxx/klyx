import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX public provider page i18n contract", () => {
  it("keeps the public provider surface read-only", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("KLYX_PUBLIC_PROVIDER_I18N");
    expect(page).toContain("KLYX_PUBLIC_PROVIDER_READ_ONLY");
    expect(page).toContain('.from("profiles")');
    expect(page).toContain('.from("provider_profiles")');
    expect(page).toContain('.from("user_services")');
    expect(page).toContain('.from("provider_gallery")');
    expect(page).toContain('.from("services")');
    expect(page).toContain('.from("service_profiles")');
    expect(page).toContain('.from("availability_slots")');
    expect(page).toContain('fetch(`/api/providers/${providerId}/verified-services`');
    expect(page).toContain('cache: "no-store"');
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("preserves publication, availability and ranking semantics", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('.eq("active", true)');
    expect(page).toContain("approvedUserServiceIds.has(item.id)");
    expect(page).toContain("!commercialData.is_published && userServices.length === 0");
    expect(page).toContain('.eq("available", true)');
    expect(page).toContain('.eq("is_active", true)');
    expect(page).toContain(".sort((a, b) => b.klyxScore - a.klyxScore)");
  });

  it("keeps provider-authored and gallery data verbatim", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("providerProfile.business_name");
    expect(page).toContain("providerProfile.headline ||");
    expect(page).toContain("providerProfile.bio");
    expect(page).toContain("service.title ?? serviceLabel");
    expect(page).toContain("service.description");
    expect(page).toContain('service.serviceArea.join(", ")');
    expect(page).toContain("item.caption || t(\"galleryAlt\")");
  });

  it("preserves quote and booking navigation without creating either action", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain('href={`/providers/${profile.id}/quote?service=${encodeURIComponent(');
    expect(page).toContain('href={`/providers/${profile.id}/book?service=${encodeURIComponent(');
    expect(page).toContain("service.slug");
  });

  it("does not reflect raw Supabase or API errors and does not refetch on locale change", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).not.toContain("firstError.message");
    expect(page).not.toContain("nestedError.message");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("error.message");
    expect(page).toContain("}, [providerId]);");
    expect(page).not.toContain("[providerId, locale]");
  });
});

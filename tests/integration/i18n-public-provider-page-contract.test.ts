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

  it("keeps provider-authored, service and gallery data loaded without restoring a catalogue", () => {
    const page = read("app/providers/[id]/page.tsx");

    expect(page).toContain("business_name, headline, bio, years_experience");
    expect(page).toContain("title: serviceProfile.title");
    expect(page).toContain('description: serviceProfile.description ?? ""');
    expect(page).toContain("serviceArea: serviceProfile.service_area ?? []");
    expect(page).toContain("travelRadiusKm: Number(serviceProfile.travel_radius_km ?? 10)");
    expect(page).toContain("providerProfile.bio");
    expect(page).toContain("primaryService.description");
    expect(page).toContain("item.caption || t(\"galleryAlt\")");
    expect(page).toContain('data-testid="klyx-other-provider-services"');
  });

  it("exposes one booking action while keeping the existing quote route intact", () => {
    const page = read("app/providers/[id]/page.tsx");
    const quotePage = read("app/providers/[id]/quote/page.tsx");
    const primaryActions =
      page.match(/data-testid="klyx-provider-primary-action"/g) ?? [];

    expect(primaryActions).toHaveLength(1);
    expect(page).toContain("/book?service=${encodeURIComponent(");
    expect(page).not.toContain("/quote?service=${encodeURIComponent(");
    expect(page).toContain("primaryService.slug");
    expect(quotePage.trim().length).toBeGreaterThan(0);
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

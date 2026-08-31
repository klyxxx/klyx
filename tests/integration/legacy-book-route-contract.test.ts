import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX legacy booking route contract", () => {
  it("redirects obsolete /book URLs directly to canonical babysitting recommendations", () => {
    const legacyPage = read("app/book/page.tsx");

    expect(legacyPage).toContain("KLYX_LEGACY_BOOK_COMPATIBILITY_ROUTE");
    expect(legacyPage).toContain('import { redirect } from "next/navigation"');
    expect(legacyPage).toContain("searchParams: Promise<SearchParams>");
    expect(legacyPage).toContain('params.set("service", "babysitting")');
    expect(legacyPage).toContain('redirect(`/recommendations?${params.toString()}`)');
    expect(legacyPage).not.toContain('redirect("/babysitters")');
    expect(legacyPage).not.toContain("useParams");
    expect(legacyPage).not.toContain("supabase");
  });

  it("keeps provider-specific booking on the canonical localized route", () => {
    const bookingPage = read("app/providers/[id]/book/page.tsx");

    expect(bookingPage).toContain("useKlyxLocale");
    expect(bookingPage).toContain("translateKlyxProviderBooking");
    expect(bookingPage).toContain('fetch("/api/bookings/create"');
    expect(bookingPage).toContain("providerId,");
    expect(bookingPage).toContain("serviceSlug,");
  });
});

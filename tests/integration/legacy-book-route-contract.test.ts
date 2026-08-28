import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX legacy booking route contract", () => {
  it("redirects the obsolete /book surface to the active babysitter flow", () => {
    const legacyPage = read("app/book/page.tsx");

    expect(legacyPage).toContain('import { redirect } from "next/navigation"');
    expect(legacyPage).toContain('redirect("/babysitters")');
    expect(legacyPage).not.toContain("useParams");
    expect(legacyPage).not.toContain("supabase");
    expect(legacyPage).not.toContain("Chargement...");
  });

  it("keeps the active provider-specific booking route localized and functional", () => {
    const bookingPage = read("app/babysitters/[id]/page.tsx");

    expect(bookingPage).toContain("useKlyxLocale");
    expect(bookingPage).toContain("translateKlyxBabysitterBooking");
    expect(bookingPage).toContain('fetch("/api/bookings/create"');
    expect(bookingPage).toContain("providerId: babysitter.id");
  });
});

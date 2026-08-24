import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX trust new i18n contract", () => {
  it("uses the shared locale provider and certified trust dictionaries", () => {
    const page = read("app/trust/new/page.tsx");
    expect(page).toContain("KLYX_TRUST_NEW_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain("translateKlyxTrustNew");
    expect(page).toContain("translateKlyxTrustReason");
    expect(page).toContain("translateKlyxTrustStatus");
    expect(page).not.toContain("Signaler un problème");
  });

  it("preserves booking discovery without reflecting Supabase errors", () => {
    const page = read("app/trust/new/page.tsx");
    expect(page).toContain('.from("bookings")');
    expect(page).toContain('.select("id, booking_date, start_time, status")');
    expect(page).toContain('.neq("status", "pending")');
    expect(page).toContain('.limit(50)');
    expect(page).not.toContain("error.message");
  });

  it("preserves the exact explicit dispute POST and user-authored description", () => {
    const page = read("app/trust/new/page.tsx");
    expect(page).toContain('fetch("/api/disputes"');
    expect(page).toContain('method: "POST"');
    expect(page).toContain("bookingId,");
    expect(page).toContain("reason,");
    expect(page).toContain("description,");
    expect(page).not.toContain("result.error");
    expect(page).toContain('router.push("/trust?created=1")');
  });

  it("keeps validation and submission explicit", () => {
    const page = read("app/trust/new/page.tsx");
    expect(page).toContain("minLength={20}");
    expect(page).toContain("maxLength={2000}");
    expect(page).toContain("description.trim().length < 20");
    expect(page).toContain('type="submit"');
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("keeps every existing dispute reason identifier exact", () => {
    const page = read("app/trust/new/page.tsx");
    for (const reason of [
      "provider_absent",
      "client_absent",
      "major_delay",
      "unfinished_work",
      "unsatisfactory_work",
      "unsafe_behavior",
      "payment_problem",
      "other",
    ]) {
      expect(page).toContain(reason);
    }
  });
});

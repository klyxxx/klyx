import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX babysitters page i18n contract", () => {
  it("localizes the directory through the certified page helper", () => {
    const page = read("app/babysitters/page.tsx");
    const helper = read("lib/klyx-babysitters-page-i18n.ts");

    expect(page).toContain("useKlyxLocale()");
    expect(page).toContain("translateKlyxBabysittersPage(locale, key)");
    expect(page).toContain('t("title")');
    expect(page).toContain('t("newSearch")');
    expect(page).toContain('t("recommendedByKlyx")');
    expect(page).toContain('t("viewProfile")');
    expect(helper).toContain('"fr"');
    expect(helper).toContain('"en"');
    expect(helper).toContain('"nl"');
    expect(helper).toContain('"de"');
    expect(helper).toContain(': "fr"');
  });

  it("preserves the real babysitting data boundary and active-provider requirements", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain('.from("services")');
    expect(page).toContain('.eq("slug", "babysitting")');
    expect(page).toContain('.from("user_services")');
    expect(page).toContain('.eq("service_id", service.id)');
    expect(page).toContain('.eq("active", true)');
    expect(page).toContain('.from("service_profiles")');
    expect(page).toContain(
      '"user_service_id, price, city, available, klyx_score, completed_jobs, cancellation_rate"'
    );
    expect(page).toContain('.eq("available", true)');
    expect(page).toContain('.from("profiles")');
    expect(page).toContain('.from("availability_slots")');
    expect(page).toContain('.eq("is_active", true)');
  });

  it("preserves matching, fallback relevance and score ordering", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("matchesCity(babysitter, city)");
    expect(page).toContain("matchesBudget(babysitter, budget)");
    expect(page).toContain("matchesAvailability(babysitter, date, time)");
    expect(page).toContain("relevance += 40");
    expect(page).toContain("relevance += 30");
    expect(page).toContain("return b.relevance - a.relevance");
    expect(page).toContain("return b.klyxScore - a.klyxScore");
    expect(page).toContain("return b.completedJobs - a.completedJobs");
  });

  it("keeps the existing KLYX score thresholds while localizing only their labels", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain('if (score >= 90) key = "scoreExcellent"');
    expect(page).toContain('else if (score >= 80) key = "scoreVeryReliable"');
    expect(page).toContain('else if (score >= 70) key = "scoreReliable"');
    expect(page).toContain('else if (score >= 60) key = "scoreFair"');
    expect(page).toContain('let key: KlyxBabysittersPageMessageKey = "scoreNew"');
    expect(page).toContain("klyxScore: Number(serviceProfile.klyx_score ?? 50)");
    expect(page).toContain("{babysitter.klyxScore.toFixed(0)}");
    expect(page).toContain("/100");
  });

  it("keeps personal provider data untouched and the detail route stable", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("babysitter.firstName");
    expect(page).toContain("babysitter.lastName");
    expect(page).toContain('babysitter.city || t("cityMissing")');
    expect(page).toContain("babysitter.cancellationRate.toFixed(1)");
    expect(page).toContain("Number(babysitter.price).toFixed(2)");
    expect(page).toContain('href={`/babysitters/${babysitter.userId}`}');
  });

  it("remains a read-only discovery page without booking or payment mutations", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).not.toContain(".insert(");
    expect(page).not.toContain(".update(");
    expect(page).not.toContain(".delete(");
    expect(page).not.toContain("/api/bookings");
    expect(page).not.toContain("/api/payment");
    expect(page).not.toContain("stripe");
    expect(page).toContain('href="/request"');
  });

  it("shows a localized safe generic load error instead of a backend error message", () => {
    const page = read("app/babysitters/page.tsx");

    expect(page).toContain("setLoadFailed(true)");
    expect(page).toContain('t("loadError")');
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("{errorMessage}");
  });
});

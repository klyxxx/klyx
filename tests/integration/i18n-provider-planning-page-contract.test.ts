import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/provider/planning/page.tsx"),
  "utf8"
);

const routeSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/provider/planning/planning-route-core.ts"
  ),
  "utf8"
);

const analyzerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/provider-planning.ts"),
  "utf8"
);

describe("KLYX provider planning read-only i18n contract", () => {
  it("keeps the exact authenticated 30-day GET and no mutations", () => {
    expect(pageSource).toContain('"/api/provider/planning?days=30"');
    expect(pageSource).toContain('cache: "no-store"');
    expect(pageSource).toContain(
      "Authorization: `Bearer ${session.access_token}`"
    );
    expect(pageSource).not.toContain('method: "POST"');
    expect(pageSource).not.toContain('method: "PATCH"');
    expect(pageSource).not.toContain('method: "DELETE"');
  });

  it("keeps refresh explicit with no polling or retries", () => {
    expect(pageSource).toContain("onClick={() => void load()}");
    expect(pageSource).toContain("void load();");
    expect(pageSource).not.toContain("setInterval(");
    expect(pageSource).not.toContain("setTimeout(");
  });

  it("keeps server planning explicitly non-automatic", () => {
    expect(routeSource).toContain("automaticChanges: false");
    expect(pageSource).toContain('t("noAutomaticChanges")');
    expect(pageSource).not.toContain("cancel");
    expect(pageSource).not.toContain("reschedule");
  });

  it("keeps all five stable warning codes produced by the analyzer", () => {
    for (const code of [
      'code: "overlap"',
      'code: "short_break"',
      'code: "long_day"',
      'code: "outside_availability"',
      'code: "pending_near_confirmed"',
    ]) {
      expect(analyzerSource).toContain(code);
    }

    expect(pageSource).toContain("translateKlyxProviderPlanningWarning(");
    expect(pageSource).not.toContain("{warning.title}");
    expect(pageSource).not.toContain("{warning.detail}");
  });

  it("keeps provider planning data and user-facing client names intact", () => {
    expect(pageSource).toContain("{booking.clientName}");
    expect(pageSource).toContain("booking.startTime.slice(0, 5)");
    expect(pageSource).toContain("booking.endTime.slice(0, 5)");
    expect(pageSource).toContain('href={`/bookings/${booking.id}`}');
    expect(pageSource).toContain("translateKlyxProviderPlanningStatus(");
  });

  it("localizes presentation without reflecting backend or network errors", () => {
    expect(pageSource).toContain("useKlyxLocale()");
    expect(pageSource).toContain("translateKlyxProviderPlanning(locale, key)");
    expect(pageSource).toContain('t("genericError")');
    expect(pageSource).not.toContain("body.error");
    expect(pageSource).not.toContain("error.message");
  });
});

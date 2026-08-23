import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission detail i18n contract", () => {
  it("localizes only the client presentation layer", () => {
    const source = read("app/bookings/split/[id]/page.tsx");

    expect(source).toContain("KLYX_SPLIT_MISSION_DETAIL_13_21");
    expect(source).toContain("KLYX_SPLIT_MISSION_DETAIL_I18N_16_09");
    expect(source).toContain("useKlyxLocale()");
    expect(source).toContain("translateKlyxSplitMission(");
    expect(source).toContain("formatKlyxSplitMissionService(");
    expect(source).toContain("formatKlyxSplitMissionStatus(");
    expect(source).toContain("formatKlyxSplitBookingStatus(");
    expect(source).toContain("formatKlyxSplitMissionDetailDate(");
    expect(source).not.toContain('new Intl.DateTimeFormat(\n    "fr-BE"');
  });

  it("preserves the authenticated GET-only mission boundary", () => {
    const source = read("app/bookings/split/[id]/page.tsx");

    expect(source).toMatch(
      /fetch\(\s*"\/api\/bookings\/split-missions\?batchId="\s*\+/
    );
    expect(source).toContain("encodeURIComponent(");
    expect(source).toContain('cache:\n                  "no-store"');
    expect(source).toContain("supabase.auth.getSession()");
    expect(source).toContain('Authorization:\n                    "Bearer " +');
    expect(source).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  it("keeps every explicit action component and financial wiring marker unchanged", () => {
    const source = read("app/bookings/split/[id]/page.tsx");

    for (const marker of [
      "KLYX_SPLIT_PROVIDER_ACCEPTANCE_WIRING_13_22",
      "KLYX_SPLIT_PRICE_CONFIRMATION_WIRING_13_23",
      "KLYX_SPLIT_PAYMENT_CONTRACT_WIRING_13_24",
      "KLYX_SPLIT_STRIPE_READINESS_WIRING_13_25",
      "KLYX_SPLIT_PAYMENT_CONFIRMATION_WIRING_13_26",
      "KLYX_SPLIT_CHECKOUT_WIRING_13_27",
      "KLYX_SPLIT_REFUND_STATUS_WIRING_13_28",
    ]) {
      expect(source).toContain(marker);
    }

    for (const component of [
      "<SplitMissionAcceptance",
      "<SplitMissionPriceConfirmation",
      "<SplitMissionPaymentPlan",
      "<SplitMissionStripeReadiness",
      "<SplitMissionPaymentConfirmation",
      "<SplitMissionCheckout",
      "<SplitMissionRefundStatus",
    ]) {
      expect(source).toContain(component);
    }

    expect(source.match(/batchId=\{mission\.batchId\}/g)?.length).toBe(7);
  });

  it("preserves booking destinations and does not turn links into mutations", () => {
    const source = read("app/bookings/split/[id]/page.tsx");

    expect(source).toContain('href="/bookings"');
    expect(source).toContain('"/bookings/" +');
    expect(source).toContain("slot.bookingId");
    expect(source).not.toContain("window.location");
    expect(source).not.toContain("router.push");
  });

  it("keeps the no-payment guarantee in every certified detail dictionary", () => {
    const source = read("app/bookings/split/[id]/page.tsx");
    const helper = read("lib/klyx-split-mission-i18n.ts");

    expect(source).toContain('"detailNoPayment"');
    expect(source).not.toContain("Aucun paiement n'est créé depuis cette page.");
    expect(helper).toContain("Aucun paiement n'est créé depuis cette page.");
    expect(helper).toContain("No payment is created from this page.");
    expect(helper).toContain("Vanaf deze pagina wordt geen betaling aangemaakt.");
    expect(helper).toContain("Auf dieser Seite wird keine Zahlung erstellt.");
  });

  it("uses stable local error states instead of rendering API error prose", () => {
    const source = read("app/bookings/split/[id]/page.tsx");

    expect(source).toContain("KLYX_SPLIT_SESSION_MISSING");
    expect(source).toContain("KLYX_SPLIT_UNAVAILABLE");
    expect(source).toContain("KLYX_SPLIT_LOAD_FAILED");
    expect(source).not.toContain("body.error ||");
    expect(source).toContain('"detailSessionMissing"');
    expect(source).toContain('"detailLoadFailed"');
  });
});

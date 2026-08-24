import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission payment plan i18n contract", () => {
  it("uses the shared locale provider and dedicated certified dictionary", () => {
    const component = read("app/bookings/split/[id]/SplitMissionPaymentPlan.tsx");

    expect(component).toContain("KLYX_SPLIT_MISSION_PAYMENT_PLAN_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain("translateKlyxSplitMissionPaymentPlan");
    expect(component).not.toContain("Architecture du paiement");
    expect(component).not.toContain("Aucun paiement n'est créé ici");
  });

  it("preserves the payment plan as an authenticated no-store GET-only read", () => {
    const component = read("app/bookings/split/[id]/SplitMissionPaymentPlan.tsx");

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/payment-plan"');
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('Authorization: "Bearer " + token');
    expect(component).not.toContain("method:");
    expect(component).not.toContain("JSON.stringify(");
  });

  it("preserves exact server block reasons without mutating their semantics", () => {
    const component = read("app/bookings/split/[id]/SplitMissionPaymentPlan.tsx");

    expect(component).toContain('"MISSION_STRUCTURE_CHANGED"');
    expect(component).toContain('"PROVIDER_ACCEPTANCE_CHANGED"');
    expect(component).toContain('"LIVE_PRICE_CHANGED"');
    expect(component).toContain('"PRICE_PROOF_MISMATCH"');
    expect(component).toContain('"MULTI_PROVIDER_ALLOCATION_REQUIRED"');
    expect(component).toContain('"PRICE_CONFIRMATION_REQUIRED"');
  });

  it("does not reflect raw backend errors and keeps payment safety wording in dictionaries", () => {
    const component = read("app/bookings/split/[id]/SplitMissionPaymentPlan.tsx");
    const helper = read("lib/klyx-split-mission-payment-plan-i18n.ts");

    expect(component).not.toContain("body.error");
    expect(component).not.toContain("error.message");
    expect(component).not.toContain("fetch(\"/api/stripe");
    expect(helper).toContain("Aucun paiement n'est créé ici");
    expect(helper).toContain("No payment is created here");
    expect(helper).toContain("aucun Checkout Stripe automatique");
    expect(helper).toContain("no automatic Stripe Checkout");
  });
});

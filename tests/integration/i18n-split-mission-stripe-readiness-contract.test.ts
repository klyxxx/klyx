import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission Stripe readiness i18n contract", () => {
  it("uses the shared locale provider and certified Stripe-readiness dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionStripeReadiness.tsx"
    );

    expect(component).toContain("KLYX_SPLIT_MISSION_STRIPE_READINESS_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(component).toContain("translateKlyxSplitMissionStripeReadiness");
    expect(component).not.toContain("Disponibilité Stripe Connect");
    expect(component).not.toContain("Aucun débit à cette étape");
  });

  it("preserves readiness as an authenticated no-store GET-only read", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionStripeReadiness.tsx"
    );

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/stripe-readiness"');
    expect(component).toContain('cache: "no-store"');
    expect(component).not.toContain("method:");
  });

  it("keeps provider states and server block reasons exact through the shared mapper", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionStripeReadiness.tsx"
    );
    const mapper = read("lib/klyx-split-mission-stripe-readiness.ts");

    for (const state of [
      "ready",
      "missing_profile",
      "market_not_ready",
      "missing_account",
      "restricted",
      "lookup_failed",
    ]) {
      expect(component).toContain(`\"${state}\"`);
    }

    expect(component).toContain("splitMissionStripeProviderStateMessageKey");
    expect(component).toContain("splitMissionStripeBlockMessageKey");

    for (const reason of [
      "PRICE_CONFIRMATION_REQUIRED",
      "PAYMENT_PLAN_REVALIDATION_REQUIRED",
      "STRIPE_SERVER_CONFIGURATION_REQUIRED",
      "CLIENT_MARKET_NOT_READY",
      "PROVIDER_MARKET_NOT_READY",
      "PROVIDER_STRIPE_NOT_READY",
      "MULTI_PROVIDER_REQUIRED",
    ]) {
      expect(mapper).toContain(reason);
    }
  });

  it("does not reflect backend errors or add automatic financial behavior", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionStripeReadiness.tsx"
    );
    const helper = read("lib/klyx-split-mission-stripe-readiness-i18n.ts");

    expect(component).not.toContain("body.error");
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
    expect(component).not.toContain("PaymentIntent(");
    expect(component).not.toContain("stripe.paymentIntents");
    expect(component).not.toContain("stripe.checkout");
    expect(component).not.toContain("stripe.transfers");
    expect(helper).toContain("aucun PaymentIntent");
    expect(helper).toContain("no PaymentIntent");
    expect(helper).toContain("aucun paiement automatique");
    expect(helper).toContain("no automatic payment");
  });
});

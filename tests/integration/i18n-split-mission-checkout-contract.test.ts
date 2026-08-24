import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission Checkout i18n contract", () => {
  it("uses the shared locale provider and certified Checkout dictionary", () => {
    const component = read("app/bookings/split/[id]/SplitMissionCheckout.tsx");

    expect(component).toContain("KLYX_SPLIT_MISSION_CHECKOUT_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(component).toContain("translateKlyxSplitMissionCheckout");
    expect(component).not.toContain("Paiement sécurisé");
    expect(component).not.toContain("Préparer mes paiements");
  });

  it("preserves the authenticated no-store GET and exact explicit preparation POST", () => {
    const component = read("app/bookings/split/[id]/SplitMissionCheckout.tsx");

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/checkout"');
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('method: "POST"');
    expect(component).toContain("checkoutPreparationConfirmed: true");
    expect(component).toContain('"Content-Type": "application/json"');
  });

  it("keeps preparation and every Checkout opening as explicit user actions", () => {
    const component = read("app/bookings/split/[id]/SplitMissionCheckout.tsx");

    expect(component).toContain("onClick={() => void prepare()}");
    expect(component).toContain("href={unit.checkoutUrl}");
    expect(component).toContain("unit.paid ? (");
    expect(component).toContain(") : unit.checkoutUrl ? (");
    expect(component).not.toContain("window.location");
    expect(component).not.toContain("router.push");
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
  });

  it("does not reflect backend errors or create Stripe payments in the client", () => {
    const component = read("app/bookings/split/[id]/SplitMissionCheckout.tsx");
    const helper = read("lib/klyx-split-mission-checkout-i18n.ts");

    expect(component).not.toContain("body.error");
    expect(component).not.toContain("stripe.checkout.sessions.create");
    expect(component).not.toContain("stripe.paymentIntents");
    expect(component).not.toContain("stripe.transfers");
    expect(helper).toContain("Aucun paiement n'est lancé automatiquement");
    expect(helper).toContain("No payment is started automatically");
    expect(helper).toContain("webhook KLYX");
  });

  it("pins the existing server-side payment and idempotency locks", () => {
    const route = read("app/api/bookings/split-missions/[id]/checkout/route.ts");

    expect(route).toContain("checkoutPreparationConfirmed");
    expect(route).toContain("SPLIT_CHILD_ALREADY_HAS_PAYMENT");
    expect(route).toContain("SPLIT_PAYMENT_CONFIRMATION_REQUIRED");
    expect(route).toContain("SPLIT_PAYMENT_PLAN_HASH_MISMATCH");
    expect(route).toContain("klyx_claim_split_payment_unit_13_27");
    expect(route).toContain("idempotencyKey:");
    expect(route).toContain('existing.payment_status ===');
    expect(route).toContain('"paid"');
    expect(route).toContain("explicitStripeCheckoutRequired:");
    expect(route).toContain("automaticRedirect:");
    expect(route).toContain("automaticPayment:");
    expect(route).toContain("moneyMovedAutomatically:");
  });
});

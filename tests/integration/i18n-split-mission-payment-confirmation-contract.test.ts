import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission payment confirmation i18n contract", () => {
  it("uses the shared locale provider and certified payment-confirmation dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPaymentConfirmation.tsx"
    );

    expect(component).toContain("KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain(
      'from "@/app/components/KlyxLocaleProvider"'
    );
    expect(component).toContain("translateKlyxSplitMissionPaymentConfirmation");
    expect(component).not.toContain("Confirmation finale du paiement");
    expect(component).not.toContain("Aucun débit n'a encore été effectué");
  });

  it("preserves the authenticated no-store GET and exact explicit POST", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPaymentConfirmation.tsx"
    );

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/payment-confirmation"');
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('method: "POST"');
    expect(component).toContain("paymentConfirmed: true");
    expect(component).toContain("finalAmountAcknowledged: true");
    expect(component).toContain(
      "separateProviderPaymentsAcknowledged: true"
    );
  });

  it("requires both explicit acknowledgements before the POST action", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPaymentConfirmation.tsx"
    );

    expect(component).toContain("!amountAcknowledged ||");
    expect(component).toContain("!splitAcknowledged");
    expect(component).toContain(
      "disabled={busy || !amountAcknowledged || !splitAcknowledged}"
    );
    expect(component).toContain('type="checkbox"');
    expect(component).toContain("onClick={() => void confirm()}");
  });

  it("keeps the known server block reasons exact", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPaymentConfirmation.tsx"
    );

    for (const reason of [
      "PRICE_CONFIRMATION_REQUIRED",
      "MISSION_STRUCTURE_CHANGED",
      "LIVE_PAYMENT_PLAN_CHANGED",
      "PROVIDER_STRIPE_NOT_READY",
      "PROVIDER_STRIPE_LOOKUP_FAILED",
      "PAYMENT_ALLOCATION_MISMATCH",
    ]) {
      expect(component).toContain(reason);
    }
  });

  it("does not reflect backend errors or add automatic financial behavior", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPaymentConfirmation.tsx"
    );
    const helper = read(
      "lib/klyx-split-mission-payment-confirmation-i18n.ts"
    );

    expect(component).not.toContain("body.error");
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
    expect(component).not.toContain("PaymentIntent(");
    expect(component).not.toContain("stripe.paymentIntents");
    expect(component).not.toContain("stripe.checkout");
    expect(component).not.toContain("stripe.transfers");
    expect(helper).toContain("Aucun PaymentIntent");
    expect(helper).toContain("creates no PaymentIntent");
  });
});

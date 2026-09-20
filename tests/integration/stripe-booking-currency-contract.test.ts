import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// KLYX_STRIPE_CANONICAL_BOOKING_CURRENCY_12B_6_FIX
describe("KLYX Stripe booking currency contract", () => {
  it("uses the global presentment currency snapshot with legacy currency fallback", () => {
    const filePath = path.join(
      process.cwd(),
      "app/api/stripe/create-checkout-session/route-core.ts"
    );

    expect(fs.existsSync(filePath)).toBe(true);

    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain("currency: string | null;");
    expect(source).toContain("presentment_currency: string | null;");
    expect(source).toContain(
      "(booking.presentment_currency ?? booking.currency)"
    );
    expect(source).toContain("presentmentCurrency.toLowerCase()");
    expect(source).toContain("toKlyxStripeChargeAmount(");
    expect(source).not.toContain("booking.currency_code");
  });
});

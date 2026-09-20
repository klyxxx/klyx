import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "scripts/sync-stripe-country-currency-capabilities.mjs"
  ),
  "utf8"
);

describe("Stripe Country Specs capability sync", () => {
  it("uses Stripe Country Specs rather than a permanent country allow-list", () => {
    expect(source).toContain("stripe.countrySpecs.list");
    expect(source).toContain("supported_payment_currencies");
    expect(source).toContain("supported_bank_account_currencies");
    expect(source).toContain(
      'onConflict: "provider,country_code,currency_code"'
    );
  });

  it("keeps currency unit exceptions separate from product country support", () => {
    expect(source).toContain("STRIPE_CHARGE_OVERRIDES");
    expect(source).toContain("ISK");
    expect(source).toContain("UGX");
    expect(source).not.toContain("KLYX_SUPPORTED_COUNTRIES");
  });
});

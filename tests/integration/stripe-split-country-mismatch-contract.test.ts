import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const readinessRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/stripe-readiness/route.ts"
  ),
  "utf8"
);

const checkoutRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/bookings/split-missions/[id]/checkout/route.ts"
  ),
  "utf8"
);

const readinessMessages = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-split-mission-stripe-readiness.ts"),
  "utf8"
);

const readinessI18n = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-split-mission-stripe-readiness-i18n.ts"),
  "utf8"
);

describe("KLYX split Connect country invariant", () => {
  it("fails closed in split readiness when the Stripe country differs", () => {
    expect(readinessRoute).toContain("assessStripeConnectCountry");
    expect(readinessRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(readinessRoute).toContain("account.country");
    expect(readinessRoute).toContain('"country_mismatch"');
  });

  it("keeps the POST checkout as an independent country authority", () => {
    expect(checkoutRoute).toContain("assessStripeConnectCountry");
    expect(checkoutRoute).toContain("STRIPE_ACCOUNT_COUNTRY_MISMATCH");
    expect(checkoutRoute).toContain("account.country");
    expect(checkoutRoute).toContain('participant:\n              "provider"');
  });

  it("surfaces a dedicated translated mismatch explanation", () => {
    expect(readinessMessages).toContain('state === "country_mismatch"');
    expect(readinessMessages).toContain('value === "STRIPE_ACCOUNT_COUNTRY_MISMATCH"');
    expect(readinessI18n).toContain('"stateCountryMismatch"');
    expect(readinessI18n).toContain('"blockStripeAccountCountryMismatch"');
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = fs
  .readFileSync(
    path.join(process.cwd(), ".github/workflows/klyx-golden-path.yml"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");

describe("KLYX golden path critical trigger coverage", () => {
  it("reruns the full golden path when request understanding changes", () => {
    for (const criticalPath of [
      '      - "app/api/requests/analyze/**"',
      '      - "lib/universal-service-request.ts"',
      '      - "lib/location-intent.ts"',
      '      - "lib/catalog-service-matcher.ts"',
    ]) {
      expect(workflow).toContain(criticalPath);
    }
  });

  it("reruns the full golden path when provider search matching changes", () => {
    for (const criticalPath of [
      '      - "app/api/search/providers/**"',
      '      - "lib/provider-search.ts"',
      '      - "lib/provider-skill-publication.ts"',
    ]) {
      expect(workflow).toContain(criticalPath);
    }
  });

  it("keeps the existing transaction-critical trigger families", () => {
    for (const criticalPath of [
      '      - "supabase/migrations/**"',
      '      - "app/api/bookings/**"',
      '      - "app/api/quotes/**"',
      '      - "app/api/reviews/**"',
      '      - "app/api/stripe/webhook/**"',
      '      - "lib/booking-tracking-time.ts"',
      '      - "lib/stripe-payments.ts"',
      '      - "lib/stripe-webhook-events.ts"',
      '      - "lib/payment-ledger.ts"',
      '      - "lib/api-auth.ts"',
    ]) {
      expect(workflow).toContain(criticalPath);
    }
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("refund transaction risk side-effect boundary", () => {
  it("guards individual Stripe refund creation before delegating to the unchanged core", () => {
    const wrapper = source("app/api/bookings/status/route.ts");
    const core = source("app/api/bookings/status/route-core.ts");

    expect(wrapper).toContain("enforceRefundTransactionRisk");
    expect(wrapper).toContain('subjectType: "booking"');
    expect(wrapper).toContain("refundRecipientProfileId: booking.parent_id");
    expect(wrapper).not.toContain("stripe.refunds.create");
    expect(core).toContain("stripe.refunds.create");
    expect(core).toContain(
      "idempotencyKey: `klyx-booking-refund-${booking.id}`"
    );
  });

  it("guards grouped Stripe refund creation before delegating to the unchanged core", () => {
    const wrapper = source(
      "app/api/booking-groups/[id]/cancellation/route.ts"
    );
    const core = source(
      "app/api/booking-groups/[id]/cancellation/route-core.ts"
    );

    expect(wrapper).toContain("enforceRefundTransactionRisk");
    expect(wrapper).toContain('subjectType: "booking_group"');
    expect(wrapper).toContain(
      "refundRecipientProfileId: group.client_profile_id"
    );
    expect(wrapper).not.toContain("stripe.refunds.create");
    expect(core).toContain("stripe.refunds.create");
    expect(core).toContain('"klyx-group-refund-"');
  });

  it("keeps refund decisions server-only and extends the existing audit schema", () => {
    const migration = source(
      "supabase/migrations/20260915173000_klyx_refund_transaction_risk_gate.sql"
    );
    const original = source(
      "supabase/migrations/20260915113000_klyx_transaction_risk_gate.sql"
    );

    expect(original).toContain(
      "revoke all privileges on table public.transaction_risk_decisions"
    );
    expect(migration).toContain("'checkout_create', 'refund_create'");
    expect(migration).toContain("'requester'");
    expect(migration).toContain("'refund_recipient'");
  });
});

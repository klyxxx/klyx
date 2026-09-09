import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260909214500_klyx_booking_payment_cancel_race_guard.sql"
);
const checkoutRoutePath = path.join(
  process.cwd(),
  "app/api/stripe/create-checkout-session/route.ts"
);
const bookingStatusRoutePath = path.join(
  process.cwd(),
  "app/api/bookings/status/route.ts"
);
const stripePaymentsPath = path.join(
  process.cwd(),
  "lib/stripe-payments.ts"
);
const paymentClaimPath = path.join(
  process.cwd(),
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
);

const migration = fs.readFileSync(migrationPath, "utf8");
const checkoutRoute = fs.readFileSync(checkoutRoutePath, "utf8");
const bookingStatusRoute = fs.readFileSync(bookingStatusRoutePath, "utf8");
const stripePayments = fs.readFileSync(stripePaymentsPath, "utf8");
const paymentClaim = fs.readFileSync(paymentClaimPath, "utf8");

describe("individual booking payment vs cancellation boundary", () => {
  it("serializes the payment claim on the booking row and revalidates ownership plus accepted state", () => {
    expect(paymentClaim).toContain('CREATE OR REPLACE FUNCTION "public"."klyx_claim_booking_payment"');
    expect(paymentClaim).toContain("FOR UPDATE");
    expect(paymentClaim).toContain("booking_row.parent_id <> p_client_profile_id");
    expect(paymentClaim).toContain("booking_row.status <> 'accepted'");
    expect(paymentClaim).toContain("payment_status = 'creating_checkout'");
  });

  it("blocks lifecycle exit while an attached Stripe checkout remains payable", () => {
    expect(migration).toContain("KLYX_BOOKING_PAYMENT_CANCEL_RACE_GUARD_17_01");
    expect(migration).toContain("old.booking_group_id is not null");
    expect(migration).toContain("old.status is distinct from 'accepted'");
    expect(migration).toContain("new.status is not distinct from old.status");
    expect(migration).toContain("old.payment_status = 'checkout_created'");
    expect(migration).toContain("return null;");
    expect(migration).toContain("before update of status");
  });

  it("blocks fresh checkout creation but invalidates stale claims before allowing lifecycle exit", () => {
    expect(migration).toContain("old.payment_status = 'creating_checkout'");
    expect(migration).toContain("old.payment_checkout_started_at > now() - interval '2 minutes'");
    expect(migration).toContain("new.payment_status := 'failed'");
    expect(migration).toContain("new.payment_attempt_token := null");
    expect(migration).toContain("new.payment_checkout_started_at := null");
    expect(migration).toContain("checkout_claim_stale");

    expect(checkoutRoute).toContain('.eq("payment_attempt_token", attemptToken)');
    expect(checkoutRoute).toContain("expireUnpersistedCheckoutSession");
  });

  it("keeps browser callers outside the terminal paid decision", () => {
    expect(checkoutRoute).toContain('requireAccountType(profile, "client")');
    expect(checkoutRoute).toContain("booking.parent_id !== profile.id");
    expect(checkoutRoute).toContain('booking.status !== "accepted"');
    expect(checkoutRoute).toContain("amountTotal =");
    expect(checkoutRoute).toContain("booking.estimated_amount_cents ?? booking.amount_total ?? fallbackAmount");

    expect(stripePayments).toContain('session.payment_status !==\n    "paid"');
    expect(stripePayments).toContain("verifySessionMatchesBooking");
    expect(stripePayments).toContain("booking.amount_total !==\n      session.amount_total");
    expect(stripePayments).toContain("session.currency !==\n      expectedCurrency");
  });

  it("lets the existing status CAS surface a blocked concurrent cancellation as 409", () => {
    expect(bookingStatusRoute).toContain('.eq("status", booking.status)');
    expect(bookingStatusRoute).toContain("if (!updatedBooking)");
    expect(bookingStatusRoute).toContain("La réservation vient d’être modifiée. Actualise la page.");
    expect(bookingStatusRoute).toContain("{ status: 409 }");
  });
});

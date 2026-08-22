import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260822020000_klyx_agent_confirmed_booking.sql"
);
const confirmRoute = read("app/api/agent/plans/confirm-booking/route.ts");
const bookingRoute = read("app/api/bookings/create/route.ts");
const agentPage = read("app/agent/page.tsx");
const golden = read("scripts/golden-path-agent-orchestration.mjs");
const workflow = read(".github/workflows/klyx-golden-path.yml");

describe("KLYX explicitly confirmed agent booking orchestration", () => {
  it("persists a one-to-one plan/booking relationship and service-role claim", () => {
    expect(migration).toContain("booking_id uuid references public.bookings(id)");
    expect(migration).toContain("agent_plan_id uuid references public.client_agent_plans(id)");
    expect(migration).toContain("bookings_agent_plan_unique_idx");
    expect(migration).toContain("klyx_claim_client_agent_booking_confirmation");
    expect(migration).toContain("for update");
    expect(migration).toContain("return query select 'reuse'::text");
    expect(migration).toContain("return query select 'busy'::text");
    expect(migration).toContain("return query select 'invalid'::text");
    expect(migration).toContain(
      "revoke all on function public.klyx_claim_client_agent_booking_confirmation(uuid, uuid)"
    );
    expect(migration).toContain("to service_role");
  });

  it("requires an authenticated client and an explicit booking confirmation", () => {
    expect(confirmRoute).toContain("getAuthenticatedProfile(request)");
    expect(confirmRoute).toContain('requireAccountType(profile, "client")');
    expect(confirmRoute).toContain(
      '"klyx_claim_client_agent_booking_confirmation"'
    );
    expect(confirmRoute).toContain('next_action: "pay"');
    expect(confirmRoute).toContain('requiresConfirmation: "pay"');
    expect(confirmRoute).toContain("explicitClientConfirmation: true");
  });

  it("reuses the canonical booking primitive instead of duplicating booking rules", () => {
    expect(confirmRoute).toContain(
      'POST as createBookingCore'
    );
    expect(confirmRoute).toContain("await createBookingCore(bookingRequest(request, plan))");
    expect(confirmRoute).not.toContain('.from("bookings")\n      .insert');
    expect(bookingRoute).toContain('requireAccountType(profile, "client")');
    expect(bookingRoute).toContain("isUserServiceApproved");
    expect(bookingRoute).toContain('.from("availability_slots")');
    expect(bookingRoute).toContain("clientHasConflict");
  });

  it("keeps payment completely outside booking confirmation", () => {
    expect(confirmRoute).not.toContain("create-checkout-session");
    expect(confirmRoute).not.toContain("new Stripe");
    expect(confirmRoute).not.toContain("STRIPE_SECRET_KEY");
    expect(confirmRoute).toContain('status: "ready"');
    expect(confirmRoute).toContain("requiresConfirmation: true");
    expect(golden).toContain('booked.payment_status === "unpaid"');
    expect(golden).toContain('paymentTriggeredAutomatically: false');
    expect(golden).toContain('paymentConfirmationRequired: true');
  });

  it("journals confirmation/creation and recovers retries without duplicate bookings", () => {
    expect(migration).toContain("'booking_confirmation_granted'");
    expect(migration).toContain("'booking_created'");
    expect(confirmRoute).toContain('eventType: "booking_confirmation_granted"');
    expect(confirmRoute).toContain('eventType: "booking_created"');
    expect(confirmRoute).toContain("recoverBooking(plan, profile.id)");
    expect(confirmRoute).toContain('claim.action === "reuse"');
    expect(golden).toContain('bookingCreatedAfterExplicitConfirmation: true');
    expect(golden).toContain('bookingConfirmationRetryReused: true');
    expect(golden).toContain(
      'Number(bookingsAfterConfirmation ?? 0) === Number(bookingsBefore ?? 0) + 1'
    );
  });

  it("exposes the explicit confirmation in the agent UI and remains Golden-critical", () => {
    expect(agentPage).toContain('fetch("/api/agent/plans/confirm-booking"');
    expect(agentPage).toContain("Confirmer et envoyer la réservation");
    expect(agentPage).toContain('plan.next_action === "pay"');
    expect(agentPage).toContain("Une confirmation de réservation ne déclenche jamais un");
    expect(workflow).toContain('      - "app/api/agent/**"');
    expect(workflow).toContain('      - "app/api/bookings/**"');
    expect(workflow).toContain(
      "node scripts/golden-path-agent-orchestration.mjs"
    );
  });
});

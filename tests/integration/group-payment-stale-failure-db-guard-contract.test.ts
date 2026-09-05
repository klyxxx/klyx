import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("group payment stale-failure database guard", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260905220500_klyx_group_payment_failure_stale_guard.sql"
    ),
    "utf8"
  );

  it("allows failure writes only for the currently attached checkout state", () => {
    expect(migration).toContain(
      "if old.payment_status is distinct from 'checkout_created' then"
    );
    expect(migration).toContain("return old;");
  });

  it("prevents a stale PaymentIntent from replacing the current group intent", () => {
    expect(migration).toContain("old.stripe_payment_intent_id is not null");
    expect(migration).toContain(
      "new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id"
    );
  });

  it("does not block successful reconciliation that clears failure state", () => {
    expect(migration).toContain("if new.payment_failed_at is null then");
    expect(migration).toContain("return new;");
  });

  it("enforces the contract before service-role updates reach booking_groups", () => {
    expect(migration).toContain("before update of payment_status");
    expect(migration).toContain("on public.booking_groups");
    expect(migration).toContain(
      "execute function public.klyx_guard_group_payment_failure_update();"
    );
  });
});

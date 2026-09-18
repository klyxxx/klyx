import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

const migrationPath =
  "supabase/migrations/20260915200500_klyx_platform_held_settlement_fail_closed.sql";
const claimQualificationMigrationPath =
  "supabase/migrations/20260918130000_klyx_settlement_claim_sql_qualification.sql";
const canonicalIdentityMigrationPath =
  "supabase/migrations/20260918162000_klyx_settlement_claim_canonical_stripe_identity.sql";

describe("KLYX platform-held settlement fail-closed hardening", () => {
  it("requires completed paid single-booking held truth and a real source charge before SQL claim", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain("coalesce(v_booking.status, '') <> 'completed'");
    expect(migration).toContain("coalesce(v_booking.payment_status, '') <> 'paid'");
    expect(migration).toContain("coalesce(v_booking.payment_mode, '') <> 'platform_held'");
    expect(migration).toContain("v_booking.booking_group_id is not null");
    expect(migration).toContain("coalesce(trim(v_settlement.stripe_charge_id), '') = ''");
    expect(migration).toContain("v_settlement.state not in ('held', 'release_failed', 'release_claimed')");
  });

  it("requires a fresh canonical account allow decision before the atomic claim", () => {
    const migration = compact(read(migrationPath));

    const riskIndex = migration.indexOf("from public.transaction_risk_decisions d");
    const allowIndex = migration.indexOf("d.decision = 'allow'", riskIndex);
    const freshIndex = migration.indexOf(
      "d.risk_assessed_at >= now() - interval '5 minutes'",
      allowIndex
    );
    const claimIndex = migration.indexOf("set state = 'release_claimed'", freshIndex);

    expect(riskIndex).toBeGreaterThan(-1);
    expect(migration).toContain("d.action = 'settlement_release'");
    expect(migration).toContain("d.participant = 'settlement_recipient'");
    expect(migration).toContain("d.subject_type = 'booking'");
    expect(migration).toContain("d.subject_id = p_booking_id::text");
    expect(allowIndex).toBeGreaterThan(riskIndex);
    expect(freshIndex).toBeGreaterThan(allowIndex);
    expect(claimIndex).toBeGreaterThan(freshIndex);
  });

  it("requires the frozen destination to still equal the linked #799 canonical Stripe identity", () => {
    const migration = compact(read(canonicalIdentityMigrationPath));

    expect(migration).toContain("select p.account_id, p.owner_user_id");
    expect(migration).toContain("from public.profiles as p");
    expect(migration).toContain("where a.auth_user_id = v_profile_owner_user_id");
    expect(migration).toContain(
      "select i.stripe_account_id, i.identity_state"
    );
    expect(migration).toContain(
      "from public.account_stripe_connect_identities as i"
    );
    expect(migration).toContain("coalesce(v_account_connect_state, '') <> 'linked'");
    expect(migration).toContain(
      "v_account_stripe_id is distinct from v_settlement.stripe_account_id"
    );
  });

  it("keeps a terminal customer refund atomic with settlement reversal truth", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain(
      "booking_settlements_refunded_transfer_reversal_check"
    );
    expect(migration).toContain("state <> 'refunded' or stripe_transfer_id is null or stripe_transfer_reversal_id is not null");
    expect(migration).toContain(
      "create or replace function public.klyx_finalize_platform_held_settlement_on_refund"
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("KLYX_SETTLEMENT_REFUND_RELEASE_CLAIM_ACTIVE");
    expect(migration).toContain("KLYX_SETTLEMENT_REFUND_REVERSAL_REQUIRED");
    expect(migration).toContain("set state = 'refunded'");
    expect(migration).toContain(
      "before update of payment_status, refund_status on public.bookings"
    );
  });

  it("keeps qualified claim columns after canonical identity correction", () => {
    const qualified = compact(read(claimQualificationMigrationPath));
    const canonical = compact(read(canonicalIdentityMigrationPath));

    expect(qualified).toContain(
      "update public.booking_settlements as s set state = 'release_claimed', release_attempt_number = s.release_attempt_number + 1"
    );
    expect(canonical).toContain(
      "select i.stripe_account_id, i.identity_state"
    );
    expect(canonical).toContain(
      "update public.booking_settlements as s set state = 'release_claimed', release_attempt_number = s.release_attempt_number + 1"
    );
    expect(canonical).toContain(
      "revoke all on function public.klyx_claim_booking_settlement_release(uuid, uuid) from public, anon, authenticated"
    );
    expect(canonical).toContain(
      "grant execute on function public.klyx_claim_booking_settlement_release(uuid, uuid) to service_role"
    );
  });

  it("keeps every new database capability server-only", () => {
    const migration = compact(read(migrationPath));

    expect(migration).toContain(
      "revoke all on function public.klyx_claim_booking_settlement_release(uuid, uuid) from public, anon, authenticated"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_claim_booking_settlement_release(uuid, uuid) to service_role"
    );
    expect(migration).toContain(
      "revoke all on function public.klyx_finalize_platform_held_settlement_on_refund() from public, anon, authenticated"
    );
    expect(migration).not.toContain("stripe.payouts.create");
  });
});

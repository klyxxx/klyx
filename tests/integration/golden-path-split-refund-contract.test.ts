import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs
    .readFileSync(repoPath(file), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(
  ".github/workflows/klyx-golden-path.yml"
);
const script = readRepoFile(
  "scripts/golden-path-split-refund.mjs"
);
const migration = readRepoFile(
  "supabase/migrations/20260821190000_klyx_split_booking_payment_schema.sql"
);

describe("KLYX split refund golden contract", () => {
  it("keeps the runtime proof syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-split-refund.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("keeps split payment changes inside the mutation-heavy golden gate", () => {
    expect(workflow).toContain(
      '      - "lib/split-stripe-payments.ts"'
    );
    expect(workflow).toContain(
      "node scripts/golden-path-split-refund.mjs"
    );
  });

  it("uses the real signed webhook and proves duplicate rejection", () => {
    expect(script).toContain("/api/stripe/webhook");
    expect(script).toContain('"stripe-signature"');
    expect(script).toContain('"split_payment_13_27"');
    expect(script).toContain('"refund.created"');
    expect(script).toContain('body?.splitPayment === true');
    expect(script).toContain('duplicateBody?.duplicate === true');
    expect(script).toContain('"already_processed"');
  });

  it("proves unit, child-booking and ledger refund reconciliation", () => {
    expect(script).toContain('"split_booking_payment_units"');
    expect(script).toContain('"split_booking_payment_refunds"');
    expect(script).toContain('"booking_financial_ledger"');
    expect(script).toContain('"partially_refunded"');
    expect(script).toContain('"refunded"');
    expect(script).toContain("1000/1500");
    expect(script).toContain("4000/6000/5000");
    expect(script).toContain("totalRefundedCents");
  });

  it("allows shared unit-level Stripe identifiers only for explicit split bookings", () => {
    expect(migration).toContain("connect_destination_split");
    expect(migration).toContain(
      "drop index if exists public.bookings_stripe_checkout_session_unique"
    );
    expect(migration).toContain(
      "create unique index bookings_stripe_checkout_session_unique"
    );
    expect(migration).toContain(
      "drop index if exists public.bookings_stripe_refund_id_unique"
    );
    expect(migration).toContain(
      "create unique index bookings_stripe_refund_id_unique"
    );
    expect(migration).toContain(
      "coalesce(payment_mode, '') <> 'connect_destination_split'"
    );
    expect(migration).toContain("stripe_checkout_session_id is not null");
    expect(migration).toContain("stripe_refund_id is not null");
  });
});

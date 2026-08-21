import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs.readFileSync(repoPath(file), "utf8").replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(".github/workflows/klyx-golden-path.yml");
const lifecycle = readRepoFile("scripts/golden-path-provider-finance.mjs");

describe("KLYX provider finance golden path", () => {
  it("keeps the provider finance proof syntactically valid", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ["--check", repoPath("scripts/golden-path-provider-finance.mjs")],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });

  it("runs after paid mission/review lifecycle and before local server shutdown", () => {
    const serviceLifecycle = "node scripts/golden-path-service-lifecycle.mjs";
    const providerFinance = "node scripts/golden-path-provider-finance.mjs";

    expect(workflow).toContain(serviceLifecycle);
    expect(workflow).toContain(providerFinance);
    expect(workflow.indexOf(serviceLifecycle)).toBeLessThan(
      workflow.indexOf(providerFinance)
    );
    expect(workflow.indexOf(providerFinance)).toBeLessThan(
      workflow.indexOf("Stop golden path production server")
    );
  });

  it("reads finance through the real provider API with provider auth", () => {
    expect(lifecycle).toContain('path: "/api/provider/finance"');
    expect(lifecycle).toContain("Authorization: `Bearer ${accessToken}`");
    expect(lifecycle).toContain("ACTIVE_PROFILE_COOKIE");
    expect(lifecycle).toContain('profile.account_type === "provider"');
  });

  it("requires one canonical 70 EUR payment without claiming a payout", () => {
    expect(lifecycle).toContain("Number(summary?.grossPaidCents) !== 7000");
    expect(lifecycle).toContain("Number(summary?.platformFeeCents) !== 0");
    expect(lifecycle).toContain("Number(summary?.providerAmountCents) !== 0");
    expect(lifecycle).toContain("Number(summary?.successfulPayments) !== 1");
    expect(lifecycle).toContain('transaction.paymentMode !== "platform_test_only"');
    expect(lifecycle).toContain("transaction.providerAmountCents !== null");
    expect(lifecycle).toContain("payoutClaimed: false");
  });

  it("requires the commercial finance transaction to reference the completed booking", () => {
    expect(lifecycle).toContain('status", "completed"');
    expect(lifecycle).toContain('payment_status", "paid"');
    expect(lifecycle).toContain("transaction.bookingId !== completedBooking.id");
    expect(lifecycle).toContain('transaction.entryType !== "payment_succeeded"');
    expect(lifecycle).toContain('transaction.bookingStatus !== "completed"');
  });

  it("requires read-only successful reconciliation", () => {
    expect(lifecycle).toContain("reconciliation?.checked !== true");
    expect(lifecycle).toContain("reconciliation?.reconciled !== true");
    expect(lifecycle).toContain('reconciliation?.status !== "ok"');
    expect(lifecycle).toContain("reconciliation?.readOnly !== true");
    expect(lifecycle).toContain("reconciliation?.ledgerModified !== false");
    expect(lifecycle).toContain("reconciliation?.stripeModified !== false");
    expect(lifecycle).toContain("reconciliation?.automaticCorrection !== false");
  });

  it("stays inside ephemeral Supabase and never touches Stripe network", () => {
    expect(lifecycle).toContain("assertGoldenPathIsolation");
    expect(lifecycle).toContain("if (!localSupabase)");
    expect(lifecycle).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
    expect(lifecycle).not.toContain("stripe.com");
    expect(lifecycle).not.toContain("sk_live_");
  });
});

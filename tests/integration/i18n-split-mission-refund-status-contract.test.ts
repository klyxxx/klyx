import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission refund status i18n contract", () => {
  it("uses the shared locale provider and certified refund-status dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionRefundStatus.tsx"
    );

    expect(component).toContain("KLYX_SPLIT_MISSION_REFUND_STATUS_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(component).toContain("translateKlyxSplitMissionRefundStatus");
    expect(component).not.toContain("Remboursements de la mission");
    expect(component).not.toContain("Remboursement Stripe en cours");
  });

  it("preserves refund status as an authenticated no-store GET-only read", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionRefundStatus.tsx"
    );

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/refund-status"');
    expect(component).toContain('cache: "no-store"');
    expect(component).not.toContain("method:");
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
  });

  it("preserves the exact refund status identifiers", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionRefundStatus.tsx"
    );

    for (const status of ["refunded", "partially_refunded", "processing", "failed"]) {
      expect(component).toContain(`\"${status}\"`);
    }
  });

  it("does not reflect backend failure details or add refund mutations", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionRefundStatus.tsx"
    );
    const helper = read("lib/klyx-split-mission-refund-status-i18n.ts");

    expect(component).not.toContain("body.error");
    expect(component).toContain("unit.refundFailureReason &&");
    expect(component).toContain('t("failureReasonHidden")');
    expect(component).not.toContain("{unit.refundFailureReason}");
    expect(component).not.toContain("stripe.refunds");
    expect(component).not.toContain("POST");
    expect(helper).toContain("confirmation finale de Stripe");
    expect(helper).toContain("aucun remboursement n'est automatique");
    expect(helper).toContain("no refund is automatic");
  });
});

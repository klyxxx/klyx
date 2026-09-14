import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const evaluator = source("lib/trust-safety-authority.ts");
const server = source("lib/trust-safety-server.ts");
const authorityRoute = source("app/api/trust-safety/authority/route.ts");
const reportsRoute = source("app/api/trust-safety/reports/route.ts");
const reviewRequestRoute = source("app/api/trust-safety/review-request/route.ts");
const adminRoute = source("app/api/admin/trust-safety/route.ts");
const migration = source(
  "supabase/migrations/20260912230000_klyx_trust_safety_authority.sql"
);

describe("Trust & Safety transverse authority contract", () => {
  it("is independent of the old provider account role", () => {
    expect(authorityRoute).toContain("getAuthenticatedProfile(request)");
    expect(authorityRoute).not.toContain("requireAccountType");
    expect(reportsRoute).toContain("getAuthenticatedProfile(request)");
    expect(reportsRoute).not.toContain("requireAccountType");
    expect(reviewRequestRoute).toContain("getAuthenticatedProfile(request)");
    expect(reviewRequestRoute).not.toContain("requireAccountType");
    expect(evaluator).toContain('source: "klyx_trust_safety_authority"');
  });

  it("never claims to determine legal worker status automatically", () => {
    expect(evaluator).toContain("LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC");
    expect(evaluator).toContain("legalClassificationAutomatic: false");
    expect(evaluator).toContain('"occasional_compatible"');
    expect(evaluator).toContain('"employment_via_structure"');
    expect(evaluator).toContain('"professional_independent"');
    expect(authorityRoute).toContain("legalClassificationAutomatic: false");
  });

  it("separates declarations, verification evidence, reports and restrictions", () => {
    for (const table of [
      "trust_safety_profiles",
      "trust_safety_category_policies",
      "trust_safety_qualifications",
      "trust_safety_verifications",
      "trust_safety_reports",
      "trust_safety_restrictions",
      "trust_safety_audit_events",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(server).toContain('.from("trust_safety_profiles")');
    expect(server).toContain('.from("trust_safety_qualifications")');
    expect(server).toContain('.from("trust_safety_verifications")');
    expect(server).toContain('.from("trust_safety_restrictions")');
  });

  it("keeps all authority tables server-only behind RLS", () => {
    expect(migration).toContain(
      "revoke all privileges on table public.trust_safety_profiles from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.trust_safety_reports from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.trust_safety_restrictions from public, anon, authenticated;"
    );
    expect(migration).toContain('create policy "klyx_server_only_deny_all"');
    expect(migration).toContain("grant all privileges on table public.trust_safety_audit_events to service_role;");
  });

  it("treats reports, no-shows and disputes as signals rather than automatic punishment", () => {
    expect(reportsRoute).toContain("automaticSuspension: false");
    expect(evaluator).toContain("NO_SHOW_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
    expect(evaluator).toContain("DISPUTE_HISTORY_IS_SIGNAL_NOT_AUTOMATIC_PENALTY");
    expect(evaluator).toContain("UNRESOLVED_FRAUD_REPORT_REQUIRES_REVIEW");
    expect(migration).not.toMatch(/trigger[\s\S]{0,250}trust_safety_restrictions/i);
  });

  it("requires a real booking for no-show reports", () => {
    expect(reportsRoute).toContain('selectedType === "no_show" && !bookingId');
    expect(reportsRoute).toContain("verifyBookingRelationship");
    expect(reportsRoute).toContain("reporterProfileId");
    expect(reportsRoute).toContain("subjectProfileId");
  });

  it("requires human-admin authority and explanations for sensitive decisions", () => {
    expect(adminRoute).toContain("requireKlyxAdmin()");
    expect(adminRoute).toContain('action === "review_legal_path"');
    expect(adminRoute).toContain('action === "impose_restriction"');
    expect(adminRoute).toContain('action === "review_restriction"');
    expect(adminRoute).toContain("reasonCode(body.reasonCode)");
    expect(adminRoute).toContain("explanation.length < 20");
    expect(adminRoute).toContain("The reviewed path must match the person’s current declaration.");
  });

  it("makes restrictions explicitly reviewable by the affected profile", () => {
    expect(reviewRequestRoute).toContain('review_status: "pending"');
    expect(reviewRequestRoute).toContain('status: "under_review"');
    expect(reviewRequestRoute).toContain("restriction_review_requested");
    expect(adminRoute).toContain('decision === "lifted" ? "lifted" : "active"');
  });

  it("preserves legacy provider verification only as migration compatibility", () => {
    expect(server).toContain("readLegacyProviderState");
    expect(server).toContain('.from("provider_legal_profiles")');
    expect(server).toContain('.from("provider_verifications")');
    expect(authorityRoute).not.toContain("provider_legal_profiles");
    expect(authorityRoute).not.toContain("provider_verifications");
  });

  it("does not touch Stripe or refund behavior", () => {
    for (const file of [evaluator, server, authorityRoute, reportsRoute, reviewRequestRoute, adminRoute]) {
      expect(file).not.toContain("stripe.checkout");
      expect(file).not.toContain("refundPayment");
      expect(file).not.toContain("payment_intent");
    }
  });
});

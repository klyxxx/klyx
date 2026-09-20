import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const migration = read(
  "supabase/migrations/20260920093000_klyx_economic_identity_foundation.sql"
);
const economicServer = read("lib/economic-identity-server.ts");
const connectWebhook = read("app/api/stripe/connect-webhook/route.ts");
const documentation = read("docs/economic-identity-foundation.md");

describe("economic identity foundation contract", () => {
  it("keeps accounts.id canonical with exactly one economic identity per account", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_identities"
    );
    expect(migration).toContain(
      "constraint economic_identities_account_key unique (account_id)"
    );
    expect(migration).toContain("references public.accounts(id)");
    expect(documentation).toContain(
      "There is exactly one"
    );
    expect(documentation).toContain("accounts.id");
  });

  it("does not create a parallel capability or qualification authority", () => {
    expect(migration).not.toContain(
      "create table if not exists public.economic_capabilities"
    );
    expect(migration).not.toContain(
      "create table if not exists public.activity_qualifications"
    );
    expect(migration).toContain(
      "alter table public.account_capability_qualifications"
    );
    expect(migration).toContain("add column if not exists activity_key text");
    expect(migration).toContain(
      "add column if not exists jurisdiction_code text"
    );
    expect(migration).toContain(
      "create or replace view public.economic_activity_qualification_projection"
    );
    expect(migration).toContain(
      "from public.account_capability_qualifications as qualification"
    );
  });

  it("projects activity eligibility from Trust & Safety rather than reimplementing it", () => {
    expect(migration).toContain(
      "create or replace view public.economic_activity_eligibility_projection"
    );
    expect(migration).toContain(
      "from public.trust_eligibility_decisions as decision"
    );
    expect(migration).not.toContain(
      "insert into public.trust_eligibility_decisions"
    );
    expect(documentation).toContain("contains no independent evaluator");
  });

  it("models KYC/KYB as multi-state cases, never a verified boolean", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_verification_cases"
    );
    for (const status of [
      "not_required",
      "required",
      "pending",
      "pending_external_review",
      "verified",
      "failed",
      "expired",
      "restricted",
      "human_review",
    ]) {
      expect(migration).toContain("'" + status + "'");
    }
    expect(migration).not.toMatch(/\bverified\s+boolean\b/i);
  });

  it("forbids an LLM from being a persisted final regulatory decision source", () => {
    expect(migration).toContain(
      "constraint economic_verification_cases_decision_source_check"
    );
    expect(migration).toContain("'trusted_provider'");
    expect(migration).toContain("'deterministic_rule'");
    expect(migration).toContain("'human'");
    expect(migration).not.toMatch(
      /economic_verification_cases_decision_source_check[\s\S]{0,400}'llm'/i
    );
    expect(economicServer).not.toMatch(
      /openai|anthropic|languageModel|generateText/i
    );
  });

  it("keeps provider verification tables intact and exposes metadata-only compatibility projections", () => {
    expect(migration).toContain(
      "create or replace view public.economic_provider_verification_projection"
    );
    expect(migration).toContain(
      "join public.provider_verifications as verification"
    );
    expect(migration).toContain(
      "create or replace view public.economic_provider_verification_document_projection"
    );
    expect(migration).toContain(
      "join public.provider_verification_documents as document"
    );
    expect(migration).not.toContain("document.storage_path");
    expect(migration).not.toContain("drop table public.provider_verifications");
    expect(migration).not.toContain(
      "drop table public.provider_verification_documents"
    );
  });

  it("stores Stripe requirements and capabilities only as a canonical provider projection", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_stripe_account_projections"
    );
    for (const field of [
      "currently_due",
      "eventually_due",
      "past_due",
      "pending_verification",
      "requirement_errors",
      "disabled_reason",
      "capabilities",
      "payouts_enabled",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain(
      "references public.account_stripe_connect_identities(account_id, stripe_account_id)"
    );
    expect(migration).toContain(
      "payouts_enabled=true must never, by itself, authorize"
    );
  });

  it("rechecks canonical Stripe identity before accepting a projection", () => {
    expect(economicServer).toContain('import "server-only"');
    expect(economicServer).toContain(
      '.from("account_stripe_connect_identities")'
    );
    expect(economicServer).toContain(
      'canonical.identity_state !== "linked"'
    );
    expect(economicServer).toContain(
      "KLYX_ECONOMIC_IDENTITY_REVIEW_REQUIRED"
    );
    expect(economicServer).toContain(
      'supabaseAdmin.rpc(\n    "klyx_upsert_economic_stripe_projection"'
    );
    expect(connectWebhook).toContain(
      "syncEconomicStripeProjectionFromStripe"
    );
    expect(connectWebhook).toContain("correlationId");
  });

  it("fails closed into durable human review for canonical Stripe divergence", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_mark_economic_identity_human_review"
    );
    expect(migration).toContain("set status = 'human_review'");
    expect(migration).toContain("human_review_required = true");
    expect(economicServer).toContain("stripe_identity_not_canonical");
    expect(economicServer).toContain(
      "stripe_identity_changed_during_projection_sync"
    );
  });

  it("keeps economic restrictions scoped and separate from Trust & Safety restrictions", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_restrictions"
    );
    for (const scope of [
      "global",
      "activity",
      "jurisdiction",
      "activity_jurisdiction",
    ]) {
      expect(migration).toContain("'" + scope + "'");
    }
    expect(documentation).toContain(
      "separate from Trust & Safety"
    );
  });

  it("makes the economic audit append-only", () => {
    expect(migration).toContain(
      "create table if not exists public.economic_identity_events"
    );
    expect(migration).toContain(
      "create trigger klyx_economic_identity_events_append_only"
    );
    expect(migration).toContain(
      "before update or delete on public.economic_identity_events"
    );
    expect(migration).toContain(
      "KLYX_ECONOMIC_IDENTITY_EVENTS_APPEND_ONLY"
    );
    expect(migration).toContain(
      "grant select, insert on table public.%I to service_role"
    );
  });

  it("contains no structural Belgium default in the new economic layer", () => {
    expect(migration).not.toMatch(/default\s+'BE'/i);
    expect(economicServer).not.toMatch(/country\s*===\s*["']BE["']/i);
    expect(documentation).toContain(
      "No country list or Belgium-specific branch is encoded"
    );
  });

  it("does not implement financial execution in Mission 10", () => {
    const mission10 = migration + "\n" + economicServer;
    expect(mission10).not.toContain("public.booking_settlements");
    expect(mission10).not.toMatch(/stripe\.transfers\./);
    expect(mission10).not.toMatch(/stripe\.refunds\./);
    expect(mission10).not.toMatch(
      /createReversal|createTransfer|createRefund/
    );
    expect(documentation).toContain(
      "Mission 10 does **not** change financial execution."
    );
  });
});

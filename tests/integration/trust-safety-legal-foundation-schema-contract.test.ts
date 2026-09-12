import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912233000_klyx_trust_safety_legal_foundation.sql"
  ),
  "utf8"
);

function executableSql() {
  return migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("KLYX Trust & Safety + legal delivery foundation", () => {
  it("uses canonical accounts as the person-level authority instead of the historical role model", () => {
    expect(migration).toMatch(
      /create table if not exists public\.trust_work_contexts[\s\S]*account_id uuid not null references public\.accounts\(id\)/
    );
    expect(migration).toMatch(
      /create table if not exists public\.trust_verifications[\s\S]*account_id uuid not null references public\.accounts\(id\)/
    );
    expect(migration).toMatch(
      /create table if not exists public\.trust_credentials[\s\S]*account_id uuid not null references public\.accounts\(id\)/
    );
    expect(migration).toMatch(
      /create table if not exists public\.trust_eligibility_decisions[\s\S]*account_id uuid not null references public\.accounts\(id\)/
    );

    const sql = executableSql();
    expect(sql).not.toMatch(/insert\s+into\s+public\.provider_legal_profiles/i);
    expect(sql).not.toMatch(/update\s+public\.provider_legal_profiles/i);
    expect(sql).not.toMatch(/from\s+public\.provider_legal_profiles/i);
  });

  it("stores declarations as facts and keeps legal pathway outcomes explicitly non-final", () => {
    expect(migration).toContain("declared_pathway_intent");
    expect(migration).toContain("'occasional'");
    expect(migration).toContain("'employment_structure'");
    expect(migration).toContain("'independent'");
    expect(migration).toContain(
      "Declarations are facts/intents, not a legal classification."
    );
    expect(migration).toContain("'undetermined'");
    expect(migration).toContain("'multiple_possible'");
    expect(migration).toContain("'occasional_compatible'");
    expect(migration).toContain("'employment_structure_required'");
    expect(migration).toContain("'independent_compatible'");
  });

  it("supports identity, reusable verifications and category-scoped qualifications", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_verifications"
    );
    expect(migration).toContain(
      "create table if not exists public.trust_credentials"
    );
    expect(migration).toContain("verification_kind text not null");
    expect(migration).toContain("credential_kind text not null");
    expect(migration).toContain("category_key text");
    expect(migration).toContain("jurisdiction_code text not null default 'BE'");
    expect(migration).toContain("evidence_ref text");
    expect(migration).toContain(
      "Do not store raw identity documents in this table."
    );
  });

  it("keeps trust explainable and separate from restrictions", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_level_assessments"
    );
    expect(migration).toContain("reason_codes jsonb not null");
    expect(migration).toContain("explanation text not null");
    expect(migration).toContain(
      "Restrictions and suspensions live separately and must not be hidden inside a numeric trust score."
    );
    expect(migration).not.toMatch(/trust_score\s+(integer|numeric|double|real)/i);
  });

  it("versions category and jurisdiction rules instead of hard-coding one global gate", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_category_policies"
    );
    expect(migration).toContain("jurisdiction_code text not null");
    expect(migration).toContain("category_key text not null");
    expect(migration).toContain("version integer not null");
    expect(migration).toContain(
      "unique (jurisdiction_code, category_key, version)"
    );
    expect(migration).toContain("requirements jsonb not null");
    expect(migration).toContain("requires_human_review boolean not null");
  });

  it("creates a unified case base for reports, fraud, no-show, safety and disputes", () => {
    expect(migration).toContain("create table if not exists public.trust_cases");
    expect(migration).toContain("'report'");
    expect(migration).toContain("'fraud'");
    expect(migration).toContain("'no_show'");
    expect(migration).toContain("'dispute'");
    expect(migration).toContain("'safety'");
    expect(migration).toContain(
      "legacy_dispute_id uuid references public.disputes(id) on delete set null"
    );
    expect(migration).toContain(
      "A report is evidence to investigate, not proof of wrongdoing."
    );
  });

  it("requires every restriction to have a case, reason and rationale", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_restrictions"
    );
    expect(migration).toContain(
      "case_id uuid not null references public.trust_cases(id) on delete restrict"
    );
    expect(migration).toContain("reason_code text not null");
    expect(migration).toContain("rationale text not null");
  });

  it("prevents an automated restriction from becoming indefinite or unreviewed", () => {
    expect(migration).toMatch(
      /imposed_by <> 'system'[\s\S]*human_review_required = true[\s\S]*ends_at is not null[\s\S]*review_due_at is not null/
    );
    expect(migration).toContain("trust_restrictions_review_queue_idx");
  });

  it("records explainable, version-linked eligibility decisions and human appeals", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_eligibility_decisions"
    );
    expect(migration).toContain("policy_id uuid references public.trust_category_policies");
    expect(migration).toContain("reason_codes jsonb not null");
    expect(migration).toContain("required_actions jsonb not null");
    expect(migration).toContain("explanation text not null");
    expect(migration).toContain("human_review_required boolean not null");
    expect(migration).toContain(
      "create table if not exists public.trust_decision_reviews"
    );
    expect(migration).toContain("'appeal'");
    expect(migration).toContain("outcome_decision_id uuid references public.trust_eligibility_decisions");
  });

  it("does not permit policy-engine ineligibility without a human-review path", () => {
    expect(migration).toMatch(
      /decision_source <> 'policy_engine'[\s\S]*decision <> 'ineligible'[\s\S]*human_review_required = true/
    );
  });

  it("keeps every new Trust & Safety table server-only at the database boundary", () => {
    const tables = [
      "trust_work_contexts",
      "trust_verifications",
      "trust_credentials",
      "trust_level_assessments",
      "trust_category_policies",
      "trust_cases",
      "trust_case_events",
      "trust_restrictions",
      "trust_eligibility_decisions",
      "trust_decision_reviews",
    ];

    for (const table of tables) {
      expect(migration).toContain(`'${table}'`);
    }

    expect(migration).toContain(
      "revoke all privileges on table public.%I from public, anon, authenticated"
    );
    expect(migration).toContain(
      "grant all privileges on table public.%I to service_role"
    );
    expect(migration).toContain(
      "create policy klyx_server_only_deny_all on public.%I for all to anon, authenticated using (false) with check (false)"
    );
  });

  it("extends the founder security audit to the new sensitive tables", () => {
    expect(migration).toContain("create or replace function public.klyx_security_audit()");
    expect(migration).toContain("'accounts'");
    expect(migration).toContain("'trust_cases'");
    expect(migration).toContain("'trust_restrictions'");
    expect(migration).toContain("'trust_eligibility_decisions'");
    expect(migration).toContain("'trust_decision_reviews'");
  });
});

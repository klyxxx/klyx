import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260912234000_klyx_trust_legal_assessments.sql"
  ),
  "utf8"
);

describe("KLYX legal-pathway assessment boundary", () => {
  it("makes legal-pathway assessment a first-class account-level artifact", () => {
    expect(migration).toContain(
      "create table if not exists public.trust_legal_assessments"
    );
    expect(migration).toContain(
      "account_id uuid not null references public.accounts(id) on delete cascade"
    );
    expect(migration).toContain("jurisdiction_code text not null");
    expect(migration).toContain("category_key text not null");
    expect(migration).toContain("target_type text not null");
  });

  it("uses compatibility pathways instead of asserting an irreversible legal status", () => {
    expect(migration).toContain("'undetermined'");
    expect(migration).toContain("'occasional_compatible'");
    expect(migration).toContain("'employment_structure_required'");
    expect(migration).toContain("'independent_compatible'");
    expect(migration).toContain("'multiple_possible'");
    expect(migration).toContain(
      "It does not establish an irreversible legal employment/self-employment status."
    );
  });

  it("defaults an undetermined assessment into a pending human-review state", () => {
    expect(migration).toContain("pathway text not null default 'undetermined'");
    expect(migration).toContain(
      "human_review_required boolean not null default true"
    );
    expect(migration).toContain("review_status text not null default 'pending'");
    expect(migration).toMatch(
      /pathway not in \('undetermined', 'multiple_possible'\)[\s\S]*or human_review_required = true/
    );
  });

  it("records reason codes, explanation and normalized facts for explainability", () => {
    expect(migration).toContain("reason_codes jsonb not null default '[]'::jsonb");
    expect(migration).toContain("explanation text not null");
    expect(migration).toContain("facts_snapshot jsonb not null default '{}'::jsonb");
    expect(migration).toContain(
      "Do not copy raw identity documents, private-message bodies or unnecessary sensitive evidence."
    );
  });

  it("makes human-authored assessments attributable", () => {
    expect(migration).toContain(
      "assessed_by_auth_user_id uuid references auth.users(id) on delete set null"
    );
    expect(migration).toMatch(
      /assessment_source <> 'human'[\s\S]*or assessed_by_auth_user_id is not null/
    );
  });

  it("links mission eligibility to the exact legal assessment used", () => {
    expect(migration).toContain(
      "alter table public.trust_eligibility_decisions"
    );
    expect(migration).toContain(
      "add column if not exists legal_assessment_id uuid"
    );
    expect(migration).toContain(
      "references public.trust_legal_assessments(id)"
    );
    expect(migration).toContain("on delete restrict");
  });

  it("keeps legal assessments server-only", () => {
    expect(migration).toContain(
      "alter table public.trust_legal_assessments enable row level security"
    );
    expect(migration).toMatch(
      /revoke all privileges on table public\.trust_legal_assessments\s+from public, anon, authenticated;/
    );
    expect(migration).toMatch(
      /grant all privileges on table public\.trust_legal_assessments\s+to service_role;/
    );
    expect(migration).toMatch(
      /create policy klyx_server_only_deny_all[\s\S]*to anon, authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/
    );
  });

  it("makes the founder security audit automatically include future trust tables", () => {
    expect(migration).toContain(
      "or c.relname like 'trust\\_%' escape '\\'"
    );
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260912133000_klyx_provider_legal_authority.sql"
  ),
  "utf8"
);

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/legal-authority/route.ts"),
  "utf8"
);

const serverAuthority = fs.readFileSync(
  path.join(process.cwd(), "lib/provider-legal-authority-server.ts"),
  "utf8"
);

const evaluator = fs.readFileSync(
  path.join(process.cwd(), "lib/provider-legal-authority.ts"),
  "utf8"
);

describe("KLYX provider legal authority security contract", () => {
  it("keeps legal evidence server-only behind RLS deny-all", () => {
    expect(migration).toContain(
      "alter table public.provider_legal_profiles enable row level security;"
    );
    expect(migration).toContain(
      "revoke all privileges on table public.provider_legal_profiles\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant all privileges on table public.provider_legal_profiles\n  to service_role;"
    );
    expect(migration).toContain('create policy "klyx_server_only_deny_all"');
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
    expect(migration).not.toMatch(
      /grant\s+(select|insert|update|delete|all privileges)[^;]*to\s+(anon|authenticated)\s*;/i
    );
  });

  it("adds the authority table to the canonical security audit", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_security_audit()"
    );
    expect(migration).toContain("'provider_legal_profiles'");
    expect(migration).toContain(
      "grant execute on function public.klyx_security_audit()\n  to service_role;"
    );
  });

  it("separates provider declarations from server-controlled verification", () => {
    expect(migration).toContain("declared_student_context");
    expect(migration).toContain("enterprise_registration_verification");
    expect(migration).toContain("social_insurance_fund_verification");
    expect(migration).toContain("employment_arrangement_verification");
    expect(migration).toContain("human_review_status");
    expect(migration).toContain(
      "Student status must never be treated as a standalone legal work status."
    );

    expect(route).not.toContain("humanReviewStatus");
    expect(route).not.toContain("enterpriseRegistrationVerification");
    expect(route).not.toContain("employmentArrangementVerification");
    expect(serverAuthority).toContain(
      'update.human_review_status = "not_reviewed"'
    );
    expect(serverAuthority).toContain("update.human_reviewed_path = null");
  });

  it("requires an authenticated active provider profile before exposing authority", () => {
    expect(route).toContain("await supabase.auth.getUser()");
    expect(route).toContain("await getActiveProfile()");
    expect(route).toContain('profile.accountType !== "provider"');
    expect(route).toContain("getProviderLegalAuthority(profile)");
    expect(route).toContain("updateProviderLegalDeclarations(profile, patch)");
  });

  it("keeps legal classification explicitly non-automatic and versioned", () => {
    expect(evaluator).toContain("LEGAL_CLASSIFICATION_IS_NOT_AUTOMATIC");
    expect(evaluator).toContain("STUDENT_IS_CONTEXT_NOT_LEGAL_PATH");
    expect(evaluator).toContain(
      "PLATFORM_WORK_CLASSIFICATION_REQUIRES_FACTUAL_REVIEW"
    );
    expect(evaluator).toContain(
      'PROVIDER_LEGAL_RULESET_VERSION = "be-provider-legal-v1"'
    );
  });
});

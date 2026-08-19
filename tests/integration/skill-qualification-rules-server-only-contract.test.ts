import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260820002000_klyx_skill_qualification_rules_server_only.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const helperPath = "lib/skill-qualification.ts";
const requirementsRoutePath = "app/api/provider/skill-requirements/route.ts";
const verificationRoutePath = "app/api/provider/skills-verification/route.ts";
const requirementsPanelPath = "app/provider/skills/SkillRequirementsPanel.tsx";

describe("skill qualification rules server-only contract", () => {
  it("removes browser table privileges and keeps service_role access", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_SKILL_QUALIFICATION_RULES_SERVER_ONLY_12B_13G"
    );
    expect(source).toContain(
      "revoke all privileges on table public.skill_qualification_rules\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.skill_qualification_rules\n  to service_role;"
    );
    expect(source).not.toContain(
      "grant select on table public.skill_qualification_rules"
    );
  });

  it("closes the canonical baseline broad grants while keeping RLS enabled", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    expect(baseline).toContain(
      'ALTER TABLE "public"."skill_qualification_rules" ENABLE ROW LEVEL SECURITY;'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "anon";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "authenticated";'
    );
    expect(baseline).toContain(
      'GRANT ALL ON TABLE "public"."skill_qualification_rules" TO "service_role";'
    );
  });

  it("marks the qualification helper server-only and keeps table access on supabaseAdmin", () => {
    const helper = readFileSync(join(process.cwd(), helperPath), "utf8");

    expect(helper).toContain('import "server-only";');
    expect(helper).toContain(
      'import { supabaseAdmin } from "@/lib/supabase-admin";'
    );
    expect(helper).toContain('.from("skill_qualification_rules")');
  });

  it("keeps qualification reads behind authenticated provider APIs", () => {
    const requirementsRoute = readFileSync(
      join(process.cwd(), requirementsRoutePath),
      "utf8"
    );
    const verificationRoute = readFileSync(
      join(process.cwd(), verificationRoutePath),
      "utf8"
    );
    const panel = readFileSync(
      join(process.cwd(), requirementsPanelPath),
      "utf8"
    );

    for (const route of [requirementsRoute, verificationRoute]) {
      expect(route).toContain(
        'getSkillQualificationRule,'
      );
      expect(route).toContain(
        'from "@/lib/skill-qualification";'
      );
      expect(route).toContain(
        'import { supabaseAdmin } from "@/lib/supabase-admin";'
      );
    }

    expect(requirementsRoute).toContain("getAuthenticatedProfile(request)");
    expect(requirementsRoute).toContain('requireAccountType(profile, "provider")');
    expect(verificationRoute).toContain("getAuthenticatedProfile(request)");
    expect(verificationRoute).toContain('requireAccountType(result.profile, "provider")');

    expect(panel).toContain(
      '`/api/provider/skill-requirements?userServiceId=${encodeURIComponent('
    );
    expect(panel).not.toContain('.from("skill_qualification_rules")');
  });
});

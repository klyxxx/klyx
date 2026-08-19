import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819223500_klyx_trigger_function_execution_hardening.sql";
const baselinePath =
  "supabase/migrations/20260814000000_klyx_canonical_baseline.sql";
const priorDefaultsPath =
  "supabase/migrations/20260819173500_klyx_default_db_privileges_hardening.sql";

describe("trigger function execution hardening contract", () => {
  it("makes future public functions fail closed for browser roles", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain(
      "KLYX_TRIGGER_FUNCTION_EXECUTION_HARDENING_12B_12Z"
    );
    expect(source).toContain(
      "alter default privileges for role postgres in schema public\n  revoke all on functions from public, anon, authenticated;"
    );
    expect(source).toContain(
      "alter default privileges for role postgres in schema public\n  grant execute on functions to service_role;"
    );
  });

  it("targets only SECURITY DEFINER trigger infrastructure", () => {
    const source = readFileSync(join(process.cwd(), migrationPath), "utf8");

    expect(source).toContain("and procedure.prosecdef");
    expect(source).toContain(
      "and return_type.typname in ('trigger', 'event_trigger')"
    );
    expect(source).toContain(
      "revoke all privileges on function %s from public, anon, authenticated"
    );
    expect(source).toContain(
      "grant execute on function %s to service_role"
    );
    expect(source).not.toContain("klyx_owns_booking");
    expect(source).not.toContain("klyx_create_profile");
  });

  it("locks the historical function default grants left after 12B.12F", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");
    const priorDefaults = readFileSync(
      join(process.cwd(), priorDefaultsPath),
      "utf8"
    );

    expect(baseline).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";'
    );
    expect(baseline).toContain(
      'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";'
    );
    expect(priorDefaults).toContain("revoke all on tables");
    expect(priorDefaults).toContain("revoke all on sequences");
    expect(priorDefaults).not.toContain("revoke all on functions");
  });

  it("covers elevated trigger functions that were historically browser executable", () => {
    const baseline = readFileSync(join(process.cwd(), baselinePath), "utf8");

    for (const functionName of [
      "handle_new_user",
      "notify_new_booking",
      "notify_new_message",
      "refresh_service_profile_rating",
      "rls_auto_enable",
      "validate_booking_availability",
    ]) {
      expect(baseline).toContain(
        `GRANT ALL ON FUNCTION "public"."${functionName}"() TO "anon";`
      );
      expect(baseline).toContain(
        `GRANT ALL ON FUNCTION "public"."${functionName}"() TO "authenticated";`
      );
    }
  });
});

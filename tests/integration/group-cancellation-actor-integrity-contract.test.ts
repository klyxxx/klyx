import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("group cancellation actor integrity contract", () => {
  it("keeps participant ownership and no-self-approval enforced in PostgreSQL", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260905011000_klyx_group_cancellation_actor_integrity.sql"
      ),
      "utf8"
    );

    expect(migration).toContain(
      "KLYX_GROUP_CANCEL_REQUESTER_NOT_PARTICIPANT"
    );
    expect(migration).toContain(
      "KLYX_GROUP_CANCEL_REQUESTER_ROLE_MISMATCH"
    );
    expect(migration).toContain(
      "KLYX_GROUP_CANCEL_REQUEST_ALREADY_OWNED"
    );
    expect(migration).toContain(
      "KLYX_GROUP_CANCEL_RESOLVER_NOT_PARTICIPANT"
    );
    expect(migration).toContain("KLYX_GROUP_CANCEL_SELF_APPROVAL");
    expect(migration).toContain(
      "before update of\n  cancellation_request_status,"
    );
  });

  it("keeps the resolution RPC server-only in the canonical contract", () => {
    const baseline = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260814000000_klyx_canonical_baseline.sql"
      ),
      "utf8"
    );

    expect(baseline).toContain(
      'REVOKE ALL ON FUNCTION "public"."klyx_resolve_group_cancellation"'
    );
    expect(baseline).toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_resolve_group_cancellation"'
    );
    expect(baseline).toContain('TO "service_role";');
    expect(baseline).not.toContain(
      'GRANT ALL ON FUNCTION "public"."klyx_resolve_group_cancellation"("p_group_id" "uuid", "p_actor_profile_id" "uuid", "p_decision" "text") TO "anon";'
    );
  });
});

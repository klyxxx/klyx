import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260921174500_klyx_durable_job_claim_ambiguity_fix.sql"
  ),
  "utf8"
);

describe("Mission 19 durable-job continuity regression", () => {
  it("fully qualifies claim queue columns that collide with RPC output names", () => {
    expect(migration).toContain(
      "jobs.attempt_count < jobs.max_attempts"
    );
    expect(migration).toContain(
      "jobs.job_type = any(v_job_types)"
    );
    expect(migration).toContain(
      "order by\n       jobs.priority asc"
    );
    expect(migration).not.toMatch(
      /and\s+attempt_count\s*<\s*max_attempts/i
    );
  });

  it("preserves the existing durable-job authority and service-role boundary", () => {
    expect(migration).toContain(
      "create or replace function public.klyx_claim_durable_jobs"
    );
    expect(migration).toContain(
      "perform public.klyx_reap_expired_durable_jobs"
    );
    expect(migration).toContain(
      "grant execute on function public.klyx_claim_durable_jobs"
    );
    expect(migration).toContain("to service_role");
    expect(migration).not.toContain("insert into public.ops_durable_jobs");
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const workflow = read(".github/workflows/klyx-all-providers-certification.yml");
const report = read("scripts/certification/klyx-all-providers-final-report.mjs");
const probe = read("scripts/certification/klyx-independent-wal-network.mjs");
const scope = read("CERTIFICATION_ALL_PROVIDERS.md");

describe("independent WAL provider certification contract", () => {
  it("requires a real Cloudflare WAL proof in the aggregate certification", () => {
    expect(workflow).toContain("Independent Cloudflare WAL proof");
    expect(workflow).toContain("KLYX_INDEPENDENT_WAL_URL");
    expect(workflow).toContain("KLYX_INDEPENDENT_WAL_HMAC_SECRET");
    expect(workflow).toContain("KLYX_INDEPENDENT_WAL_ENCRYPTION_KEY");
    expect(workflow).toContain("KLYX_INDEPENDENT_WAL_KEY_ID");
    expect(workflow).toContain("KLYX_INDEPENDENT_WAL_OUTCOME");
    expect(workflow).toContain("reports/certification/independent-wal-network.json");
  });

  it("does not hardcode total Supabase outage to PASS or FAIL", () => {
    expect(report).toContain("const supabaseOutageStatus");
    expect(report).toContain('recovery === "PASS" && independentWal === "PASS"');
    expect(report).toContain('scenario: "Supabase unavailable"');
    expect(report).toContain("status: supabaseOutageStatus");
    expect(report).not.toContain('scenario: "Supabase unavailable",\n      status: "FAIL"');
    expect(report).not.toContain('scenario: "Supabase unavailable",\n      status: "PASS"');
  });

  it("proves the external failure domain with a safe encrypted Durable Object write", () => {
    expect(probe).toContain("SAFE_CERTIFICATION_WRITE");
    expect(probe).toContain("/v1/health");
    expect(probe).toContain('method: "PUT"');
    expect(probe).toContain('method: "GET"');
    expect(probe).toContain('/replicated`');
    expect(probe).toContain("ephemeral probe key");
    expect(probe).toContain("canonicalSupabaseMutations: 0");
    expect(scope).toContain("No report may infer Supabase outage recovery from source code alone.");
  });
});

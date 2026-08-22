import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const k6 = read("performance/k6/klyx-readonly.js");
const ab = read("scripts/performance/ab-local.ps1");
const workflow = read(".github/workflows/klyx-performance.yml");
const docs = read("performance/README.md");
const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};

describe("KLYX performance certification", () => {
  it("makes k6 the primary multi-profile performance tool", () => {
    for (const profile of ["smoke", "ci", "load", "stress", "spike", "soak"]) {
      expect(k6).toContain(`case "${profile}"`);
    }

    expect(k6).toContain('http_req_failed: ["rate<0.01"]');
    expect(k6).toContain('"p(50)<350"');
    expect(k6).toContain('"p(95)<900"');
    expect(k6).toContain('"p(99)<1600"');
    expect(k6).toContain("klyx_search_duration");
    expect(k6).toContain("klyx_authenticated_duration");
  });

  it("models a real read-only KLYX journey across Next.js and Supabase", () => {
    expect(k6).toContain("/auth/v1/token?grant_type=password");
    expect(k6).toContain("/rest/v1/profiles?");
    expect(k6).toContain("/api/search/providers?");
    expect(k6).toContain("/providers/${providerId}");
    expect(k6).toContain("/api/agent/plans");
    expect(k6).toContain("klyx_active_profile=");
  });

  it("hard-blocks uncontrolled remote load profiles", () => {
    expect(k6).toContain(
      'PROFILE === "smoke" && __ENV.KLYX_PERF_ALLOW_REMOTE_READ_ONLY === "true"'
    );
    expect(k6).toContain(
      "Non-loopback load/stress/spike/soak targets are forbidden."
    );
    expect(k6).not.toContain("create-checkout-session");
    expect(k6).not.toContain("confirm-booking");
    expect(k6).not.toContain("/api/messages");
    expect(k6).not.toContain("/api/stripe/");
  });

  it("keeps ApacheBench a bounded loopback-only diagnostic", () => {
    expect(ab).toContain('$allowedHosts = @("127.0.0.1", "localhost", "::1")');
    expect(ab).toContain("Requests must be between 1 and 10000");
    expect(ab).toContain("Concurrency must be between 1 and 100");
    expect(ab).toContain("remote targets are forbidden");
    expect(ab).toContain("& $ab.Source -n $Requests -c $Concurrency");
  });

  it("runs performance certification against ephemeral infrastructure in CI", () => {
    expect(workflow).toContain("KLYX Performance Certification");
    expect(workflow).toContain("Start ephemeral local Supabase");
    expect(workflow).toContain('KLYX_PERF_BASE_URL: "http://127.0.0.1:3100"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain("grafana/setup-k6-action@v1");
    expect(workflow).toContain('k6-version: "2.1.0"');
    expect(workflow).toContain("--summary-export=performance-results/k6-summary.json");
    expect(workflow).toContain("ab -n 200 -c 10 -s 15 -k");
    expect(workflow).toContain("Destroy ephemeral Supabase");
  });

  it("exposes local commands and documents the transaction safety boundary", () => {
    const scripts = packageJson.scripts ?? {};
    expect(scripts["perf:k6:smoke"]).toContain("KLYX_PERF_PROFILE=smoke");
    expect(scripts["perf:k6:load"]).toContain("KLYX_PERF_PROFILE=load");
    expect(scripts["perf:k6:stress"]).toContain("KLYX_PERF_PROFILE=stress");
    expect(scripts["perf:k6:spike"]).toContain("KLYX_PERF_PROFILE=spike");
    expect(scripts["perf:k6:soak"]).toContain("KLYX_PERF_PROFILE=soak");
    expect(scripts["perf:ab"]).toContain("ab-local.ps1");

    expect(docs).toContain("k6 comme outil principal");
    expect(docs).toContain("Golden Path isolé");
    expect(docs).toContain("paiement Stripe réseau TEST reste un test contrôlé séparé");
    expect(docs).toContain("Ne jamais lancer stress/spike/soak contre Vercel Production");
  });
});

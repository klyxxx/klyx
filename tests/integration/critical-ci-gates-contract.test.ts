import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const e2eWorkflow = read(".github/workflows/klyx-e2e.yml");
const performanceWorkflow = read(".github/workflows/klyx-performance.yml");
const k6Profile = read("performance/k6/klyx-readonly.js");

describe("KLYX critical CI gates contract", () => {
  it("keeps the protected browser verification gate complete", () => {
    expect(e2eWorkflow).toContain("name: Playwright browser verification");
    expect(e2eWorkflow).toContain("run: npm test");
    expect(e2eWorkflow).toContain("run: npx tsc --noEmit --pretty false");
    expect(e2eWorkflow).toContain("run: npm run build");
    expect(e2eWorkflow).toContain("run: npm run test:e2e");
    expect(e2eWorkflow).toContain("npm audit --omit=dev --audit-level=moderate");
    expect(e2eWorkflow).toContain("npm audit --audit-level=high");
    expect(e2eWorkflow).toContain("./scripts/check-klyx-public-repo-secrets.ps1");
  });

  it("keeps performance certification isolated and build-gated", () => {
    expect(performanceWorkflow).toContain('KLYX_PERF_BASE_URL: "http://127.0.0.1:3100"');
    expect(performanceWorkflow).toContain("Refuse unsafe manual trigger");
    expect(performanceWorkflow).toContain("run: npm test");
    expect(performanceWorkflow).toContain("run: npx tsc --noEmit --pretty false");
    expect(performanceWorkflow).toContain("run: npm run build");
    expect(performanceWorkflow).toContain("k6 run");
    expect(performanceWorkflow).toContain("ab -n 200 -c 10");
  });

  it("keeps blocking latency, error-rate and journey thresholds", () => {
    expect(k6Profile).toContain('http_req_failed: ["rate<0.01"]');
    expect(k6Profile).toContain(
      'http_req_duration: ["p(50)<350", "p(95)<900", "p(99)<1600"]'
    );
    expect(k6Profile).toContain('checks: ["rate>0.99"]');
    expect(k6Profile).toContain('klyx_journey_failures: ["rate<0.01"]');
    expect(k6Profile).toContain(
      'klyx_search_duration: ["p(95)<1000", "p(99)<1800"]'
    );
    expect(k6Profile).toContain(
      'klyx_authenticated_duration: ["p(95)<900", "p(99)<1600"]'
    );
  });
});

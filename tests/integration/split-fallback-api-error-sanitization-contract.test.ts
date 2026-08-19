import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX split fallback API error sanitization contract", () => {
  it("keeps the public split-fallback route behind a secure 5xx boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./split-fallback-core"');
    expect(source).toContain("response.status < 500");
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain('"market_split_fallback_load_failed"');
    expect(source).toContain('"KLYX_MARKET_SPLIT_FALLBACK_LOAD_FAILED"');
    expect(source).not.toContain("detail:");
  });

  it("preserves the existing 13.15 fallback logic unchanged in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/split-fallback-core.ts"
    );

    expect(source).toContain("KLYX_MULTI_PROVIDER_FALLBACK_API_13_15");
    expect(source).toContain("KLYX_MULTI_PROVIDER_FALLBACK_FIX_13_15B");
    expect(source).toContain("SINGLE_PROVIDER_FULL_COVERAGE_AVAILABLE");
    expect(source).toContain("NO_SINGLE_PROVIDER_FULL_COVERAGE");
    expect(source).toContain("per_slot_provider_coverage");
  });

  it("preserves fail-closed commercial safety flags", () => {
    const route = read(
      "app/api/market/requests/[id]/split-fallback/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/split-fallback/split-fallback-core.ts"
    );

    expect(route).toContain("automaticProviderSelection: false");
    expect(route).toContain("automaticBooking: false");
    expect(route).toContain("automaticPayment: false");
    expect(core).toContain("automaticProviderSelection:");
    expect(core).toContain("automaticBooking:");
    expect(core).toContain("automaticPayment:");
  });

  it("confines raw provider error detail to the non-route core module", () => {
    const route = read(
      "app/api/market/requests/[id]/split-fallback/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/split-fallback/split-fallback-core.ts"
    );

    expect(route).not.toContain("requestError.message");
    expect(route).not.toContain("candidateError.message");
    expect(route).not.toContain("detail:");
    expect(core).toContain("requestError.message");
    expect(core).toContain("candidateError.message");
  });
});

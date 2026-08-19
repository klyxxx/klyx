import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX split fallback confirmation API error sanitization contract", () => {
  it("keeps GET and POST behind a secure 5xx boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/confirm/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./confirm-route-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"split_plan_confirmation_check_failed"');
    expect(source).toContain('"KLYX_SPLIT_PLAN_CONFIRMATION_CHECK_FAILED"');
    expect(source).toContain('"split_plan_confirmation_create_failed"');
    expect(source).toContain('"KLYX_SPLIT_PLAN_CONFIRMATION_CREATE_FAILED"');
    expect(source).not.toContain("detail:");
  });

  it("preserves the 13.18 confirmation proof logic in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/confirm/confirm-route-core.ts"
    );

    expect(source).toContain("KLYX_SPLIT_PLAN_CONFIRMATION_API_13_18");
    expect(source).toContain("klyx_confirm_split_plan_13_18");
    expect(source).toContain("SPLIT_PLAN_CHANGED");
    expect(source).toContain("SPLIT_PLAN_CONFIRMATION_INVALIDATED");
    expect(source).toContain("explicitConfirmationProof");
  });

  it("preserves proof-consumption and duplicate-booking guards", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/confirm/confirm-route-core.ts"
    );

    expect(source).toContain("KLYX_SPLIT_PROOF_CONSUMED_13_20");
    expect(source).toContain("split_booking_proof_consumptions");
    expect(source).toContain("split_booking_batches");
    expect(source).toContain("proofLocked");
  });

  it("keeps fail-closed automation flags on sanitized 5xx responses", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/confirm/route.ts"
    );

    expect(source).toContain("automaticProviderSelection: false");
    expect(source).toContain("automaticBooking: false");
    expect(source).toContain("automaticPayment: false");
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX split booking recovery API error sanitization contract", () => {
  it("keeps GET and POST behind a secure 5xx boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/recovery/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./recovery-route-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"split_booking_recovery_check_failed"');
    expect(source).toContain('"KLYX_SPLIT_BOOKING_RECOVERY_CHECK_FAILED"');
    expect(source).toContain('"split_booking_recovery_finalize_failed"');
    expect(source).toContain('"KLYX_SPLIT_BOOKING_RECOVERY_FINALIZE_FAILED"');
    expect(source).not.toContain("detail:");
  });

  it("preserves the 13.20 recovery inspection logic in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/recovery/recovery-route-core.ts"
    );

    expect(source).toContain("KLYX_SPLIT_BOOKING_RECOVERY_API_13_20");
    expect(source).toContain("split_booking_batches");
    expect(source).toContain("split_booking_batch_items");
    expect(source).toContain("complete_but_unfinalized");
    expect(source).toContain("partial_survivors");
    expect(source).toContain("integrity_error");
  });

  it("preserves explicit recovery confirmation and fail-closed behavior", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/recovery/recovery-route-core.ts"
    );

    expect(source).toContain('body.action !==\n        "finalize"');
    expect(source).toContain("body.recoveryConfirmed !==");
    expect(source).toContain("canAutoRetry");
    expect(source).toContain("automaticBooking");
    expect(source).toContain("automaticPayment");
  });

  it("keeps fail-closed flags on sanitized 5xx responses", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/recovery/route.ts"
    );

    expect(source).toContain("canFinalize: false");
    expect(source).toContain("automaticRetry: false");
    expect(source).toContain("automaticBooking: false");
    expect(source).toContain("automaticPayment: false");
  });
});

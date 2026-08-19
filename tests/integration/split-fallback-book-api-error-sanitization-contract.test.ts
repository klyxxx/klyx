import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX split fallback booking API error sanitization contract", () => {
  it("keeps the public POST route behind a secure boundary", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./book-route-core"');
    expect(source).toContain("secureApiErrorResponse(");
    expect(source).toContain('"split_booking_create_failed"');
    expect(source).toContain('"KLYX_SPLIT_BOOKING_CREATE_FAILED"');
    expect(source).toContain('record.code !== "SPLIT_BOOKING_CREATION_FAILED"');
    expect(source).toContain('detail: "SPLIT_BOOKING_CREATION_FAILED"');
    expect(source).not.toContain("detail: message");
  });

  it("preserves all non-failure 409 responses and only scrubs the creation failure detail", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/route.ts"
    );

    expect(source).toContain("response.status !== 409");
    expect(source).toContain("return response;");
    expect(source).toContain("response.clone().json()");
  });

  it("preserves the 13.19 idempotence and rollback logic in the core", () => {
    const source = read(
      "app/api/market/requests/[id]/split-fallback/book/book-route-core.ts"
    );

    expect(source).toContain("KLYX_SPLIT_BOOKING_API_13_19");
    expect(source).toContain("SPLIT_BOOKING_BATCH_RECOVERY_REQUIRED");
    expect(source).toContain("rollbackBookings(");
    expect(source).toContain("split_booking_batches");
    expect(source).toContain("previousBatch");
    expect(source).toContain("automaticRetry:");
    expect(source).toContain("paymentCreated:");
  });

  it("keeps raw database failure details confined to the non-route core", () => {
    const route = read(
      "app/api/market/requests/[id]/split-fallback/book/route.ts"
    );
    const core = read(
      "app/api/market/requests/[id]/split-fallback/book/book-route-core.ts"
    );

    expect(route).not.toContain("confirmationError.message");
    expect(route).not.toContain("previousBatchError.message");
    expect(route).not.toContain("completionError.message");
    expect(core).toContain("confirmationError.message");
    expect(core).toContain("previousBatchError.message");
    expect(core).toContain("completionError.message");
  });
});

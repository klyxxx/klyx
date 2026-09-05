import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260905104000_klyx_market_notification_idempotency.sql"
);
const notifications = read("lib/market-notifications.ts");
const publishRoute = read("app/api/brain/market-publish/route.ts");

describe("KLYX market provider notification recovery contract", () => {
  it("gives new market notifications a database-enforced idempotency key", () => {
    expect(migration).toContain(
      "add column if not exists idempotency_key text"
    );
    expect(migration).toContain("unique (idempotency_key)");
    expect(notifications).toContain(
      "`market-provider:${params.marketRequestId}:${providerId}`"
    );
    expect(notifications).toContain('.upsert(rows, {');
    expect(notifications).toContain('onConflict: "idempotency_key"');
    expect(notifications).toContain("ignoreDuplicates: true");
  });

  it("surfaces lookup and insert failures instead of reporting full delivery success", () => {
    expect(notifications).toContain("deliveryFailed: true");
    expect(publishRoute).toContain("if (delivery.deliveryFailed)");
    expect(publishRoute).toContain(
      'throw new Error(\n      "KLYX_PROVIDER_NOTIFICATION_DELIVERY_FAILED"'
    );
  });

  it("retries provider delivery for both ordinary and raced publication replays", () => {
    expect(publishRoute).toContain(
      "marketRequestId: prior.id,\n        ...notificationParams"
    );
    expect(publishRoute).toContain(
      "marketRequestId: raced.id,\n            ...notificationParams"
    );
    expect(publishRoute).toContain(
      "marketRequestId: created.id,\n      ...notificationParams"
    );
  });
});

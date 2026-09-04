import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260905024500_klyx_brain_publish_confirmation_idempotency.sql"
);
const route = read("app/api/brain/market-publish/route.ts");

describe("KLYX assistant confirmed market publish idempotency", () => {
  it("stores one unique confirmation id per published market request", () => {
    expect(migration).toContain(
      "add column if not exists brain_confirmation_message_id uuid null"
    );
    expect(migration).toContain(
      "create unique index if not exists market_service_requests_brain_confirmation_message_uidx"
    );
    expect(migration).toContain("brain_confirmation_message_id is not null");
  });

  it("reuses an already published request before attempting another insert", () => {
    expect(route).toContain("async function existingPublishedRequest(");
    expect(route).toContain(
      '.eq("brain_confirmation_message_id", confirmationId)'
    );
    expect(route).toContain(
      "confirmation.confirmationId,\n      profile.id"
    );
    expect(route).toContain("return publishedResponse(prior.id, true);");
  });

  it("binds the insert to the exact validated confirmation proof", () => {
    expect(route).toContain(
      "const confirmation = await requireBrainMarketConfirmation({"
    );
    expect(route).toContain(
      "brain_confirmation_message_id:\n          confirmation.confirmationId"
    );
  });

  it("recovers concurrent duplicate inserts via the unique violation", () => {
    expect(route).toContain('createError.code === "23505"');
    expect(route).toContain("const raced = await existingPublishedRequest(");
    expect(route).toContain("return publishedResponse(raced.id, true);");
  });

  it("notifies providers only after this request instance wins the insert", () => {
    const insertIndex = route.indexOf('.from("market_service_requests")');
    const notifyIndex = route.indexOf("await notifyCompatibleProviders({");

    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(notifyIndex).toBeGreaterThan(insertIndex);
  });
});

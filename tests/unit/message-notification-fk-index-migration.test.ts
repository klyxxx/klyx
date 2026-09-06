import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260906084500_klyx_message_notification_fk_indexes.sql"
  ),
  "utf8"
);

const normalized = migration.toLowerCase();

const expectedIndexes = [
  ["messages_booking_id_idx", "public.messages", "booking_id"],
  ["messages_sender_id_idx", "public.messages", "sender_id"],
  ["messages_receiver_id_idx", "public.messages", "receiver_id"],
  ["notifications_user_id_idx", "public.notifications", "user_id"],
  [
    "user_notifications_booking_id_idx",
    "public.user_notifications",
    "booking_id",
  ],
] as const;

describe("message and notification FK index migration", () => {
  it("creates exactly the five live missing FK indexes", () => {
    expect(normalized.match(/create index if not exists/g)).toHaveLength(5);

    for (const [indexName, tableName, columnName] of expectedIndexes) {
      expect(normalized).toContain(`create index if not exists ${indexName}`);
      expect(normalized).toContain(`on ${tableName} (${columnName})`);
    }
  });

  it("fails closed if a same-name index does not cover the expected FK column", () => {
    expect(normalized).toContain("klyx_kly17_fk_index_drift");
    expect(normalized).toContain("index_meta.indisvalid");
    expect(normalized).toContain("key_column.ordinal = 1");
  });

  it("does not broaden scope beyond indexing messaging and notification FKs", () => {
    expect(normalized).not.toContain("drop index");
    expect(normalized).not.toContain("alter policy");
    expect(normalized).not.toContain("create policy");
    expect(normalized).not.toContain("drop policy");
    expect(normalized).not.toContain("alter table");
    expect(normalized).not.toContain("stripe");
    expect(normalized).not.toContain("payment_intent");
    expect(normalized).not.toContain("klyx_claim_booking_payment");
  });
});

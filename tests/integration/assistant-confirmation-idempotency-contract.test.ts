import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const migration = read(
  "supabase/migrations/20260905094000_klyx_brain_confirmation_idempotency.sql"
);
const confirmRoute = read("app/api/brain/confirm-request/route.ts");

describe("KLYX assistant confirmation idempotency contract", () => {
  it("keeps one confirmation proof per conversation and normalized snapshot", () => {
    expect(migration).toContain("confirmation_fingerprint text");
    expect(migration).toContain(
      "brain_messages_confirmation_fingerprint_unique"
    );
    expect(migration).toContain(
      "on public.brain_messages (conversation_id, confirmation_fingerprint)"
    );
    expect(migration).toContain("payload ->> 'action' = 'confirm_request'");
  });

  it("generates the fingerprint on the server from the confirmed snapshot", () => {
    expect(confirmRoute).toContain('createHash("sha256")');
    expect(confirmRoute).toContain("JSON.stringify({");
    expect(confirmRoute).toContain("conversationId,");
    expect(confirmRoute).toContain("request: requestSnapshot");
    expect(confirmRoute).toContain("confirmation_fingerprint:");
  });

  it("reuses the winning proof after a concurrent unique violation", () => {
    expect(confirmRoute).toContain('messageError.code !== "23505"');
    expect(confirmRoute).toContain('"confirmation_fingerprint",');
    expect(confirmRoute).toContain("existingConfirmation");
    expect(confirmRoute).toContain("confirmationId =");
  });
});

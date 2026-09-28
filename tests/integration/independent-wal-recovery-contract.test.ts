import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("independent WAL recovery contract", () => {
  it("keeps Supabase as canonical execution queue while prewriting outside Supabase", () => {
    const durable = read("lib/durable-jobs-server.ts");
    const route = read("app/api/internal/independent-wal/recover/route.ts");

    expect(durable.indexOf("persistIndependentWalJob")).toBeLessThan(
      durable.indexOf("enqueueKlyxDurableJobDirect(normalized)")
    );
    expect(durable).toContain('supabaseAdmin.rpc(\n    "klyx_enqueue_durable_job"');
    expect(route).toContain("enqueueKlyxDurableJobDirect(job)");
    expect(route).not.toContain("enqueueKlyxDurableJob(job)");
  });

  it("uses a Cloudflare Durable Object with SQLite migration and automatic alarms", () => {
    const worker = read("infra/cloudflare/independent-wal/src/index.mjs");
    const wrangler = read("infra/cloudflare/independent-wal/wrangler.jsonc");

    expect(worker).toContain("extends DurableObject");
    expect(worker).toContain("async alarm()");
    expect(worker).toContain("KLYX_RECOVERY_CALLBACK_URL");
    expect(worker).toContain("retryDelayMs");
    expect(wrangler).toContain('"new_sqlite_classes": ["KlyxIndependentWal"]');
  });

  it("cannot execute a Stripe mutation from the independent WAL layer", () => {
    for (const file of [
      "lib/independent-write-ahead.ts",
      "lib/independent-wal-client.ts",
      "app/api/internal/independent-wal/recover/route.ts",
      "infra/cloudflare/independent-wal/src/index.mjs",
    ]) {
      const source = read(file);
      expect(source).not.toContain("stripe.transfers.create");
      expect(source).not.toContain("stripe.paymentIntents.create");
      expect(source).not.toContain("stripe.refunds.create");
    }
  });
});

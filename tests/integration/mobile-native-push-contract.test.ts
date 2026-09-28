import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATION =
  "supabase/migrations/20260928190000_klyx_mobile_native_push.sql";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX native mobile push contract", () => {
  it("projects canonical user notifications into one durable delivery per installation", () => {
    const migration = read(MIGRATION);

    expect(migration).toContain("create table if not exists public.mobile_push_installations");
    expect(migration).toContain("create table if not exists public.mobile_push_outbox");
    expect(migration).toContain("unique (notification_id, installation_id)");
    expect(migration).toContain("after insert on public.user_notifications");
    expect(migration).toContain("execute function public.klyx_enqueue_mobile_push()");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("queue.claimed_at < now() - interval '5 minutes'");
  });

  it("keeps device tokens service-role only", () => {
    const migration = read(MIGRATION);

    expect(migration).toContain("alter table public.mobile_push_installations enable row level security");
    expect(migration).toContain("revoke all on table public.mobile_push_installations");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("grant all on table public.mobile_push_installations");
    expect(migration).toContain("to service_role");
  });

  it("uses a fail-closed scheduler with Vault-backed bearer authentication", () => {
    const migration = read(MIGRATION);
    const worker = read("lib/mobile-push-server.ts");
    const route = read("app/api/ops/mobile-push-tick/route.ts");

    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).toContain("klyx_mobile_push_scheduler_token");
    expect(migration).toContain("klyx-mobile-push-tick");
    expect(worker).toContain("KLYX_MOBILE_PUSH_WORKER_DISABLED");
    expect(worker).toContain("timingSafeEqual");
    expect(route).toContain("authorizeMobilePushTick");
  });

  it("sends directly to FCM v1 and APNs and invalidates dead tokens", () => {
    const worker = read("lib/mobile-push-server.ts");

    expect(worker).toContain("https://www.googleapis.com/auth/firebase.messaging");
    expect(worker).toContain("https://fcm.googleapis.com/v1/projects/");
    expect(worker).toContain("https://api.push.apple.com");
    expect(worker).toContain('"apns-push-type": "alert"');
    expect(worker).toContain("UNREGISTERED");
    expect(worker).toContain("BadDeviceToken");
    expect(worker).toContain("invalidateInstallation");
  });

  it("never sends canonical notification message text inside the native push payload", () => {
    const worker = read("lib/mobile-push-server.ts");

    expect(worker).not.toContain('select("id, type, title, message, href")');
    expect(worker).toContain('body: "Tu as une nouvelle activité dans KLYX."');
  });

  it("registers and unregisters installations through authenticated KLYX Core", () => {
    const route = read("app/api/mobile/push/installation/route.ts");
    const client = read("mobile/src/push.ts");

    expect(route).toContain("getAuthenticatedAccount(request)");
    expect(route).toContain('.eq("account_id", account.id)');
    expect(client).toContain("Crypto.randomUUID()");
    expect(client).toContain("getDevicePushTokenAsync()");
    expect(client).toContain("unregisterNativePush");
  });
});

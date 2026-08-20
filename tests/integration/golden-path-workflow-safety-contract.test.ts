import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function repoPath(file: string) {
  return path.join(process.cwd(), file);
}

function readRepoFile(file: string) {
  return fs
    .readFileSync(repoPath(file), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = readRepoFile(
  ".github/workflows/klyx-golden-path.yml"
);
const runtime = readRepoFile(
  "scripts/golden-path-runtime.mjs"
);
const bootstrap = readRepoFile(
  "scripts/golden-path-bootstrap.mjs"
);
const preflight = readRepoFile(
  "scripts/golden-path-preflight.mjs"
);
const providerFixture = readRepoFile(
  "scripts/golden-path-provider-fixture.mjs"
);
const clientLifecycle = readRepoFile(
  "scripts/golden-path-client-lifecycle.mjs"
);

describe("KLYX golden path workflow safety", () => {
  it("keeps every golden-path Node script syntactically valid", () => {
    for (const file of [
      "scripts/golden-path-runtime.mjs",
      "scripts/golden-path-bootstrap.mjs",
      "scripts/golden-path-preflight.mjs",
      "scripts/golden-path-provider-fixture.mjs",
      "scripts/golden-path-client-lifecycle.mjs",
      "scripts/golden-path-service-lifecycle.mjs",
    ]) {
      expect(() =>
        execFileSync(process.execPath, ["--check", repoPath(file)], {
          stdio: "pipe",
        })
      ).not.toThrow();
    }
  });

  it("runs manually or after filtered main changes and still requires mutation confirmation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("      - main");
    expect(workflow).toContain(
      '      - ".github/workflows/klyx-golden-path.yml"'
    );
    expect(workflow).toContain(
      '      - "supabase/migrations/**"'
    );
    expect(workflow).toContain(
      '      - "app/api/bookings/**"'
    );
    expect(workflow).toContain(
      '      - "app/api/stripe/webhook/**"'
    );
    expect(workflow).toContain(
      '      - "lib/booking-tracking-time.ts"'
    );
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).toContain(
      "KLYX_GOLDEN_PATH_MUTATIONS_ENABLED: ${{ github.event_name == 'push' && 'true' || inputs.confirm_isolated_e2e }}"
    );
    expect(workflow).toContain(
      'if [ "$KLYX_GOLDEN_PATH_MUTATIONS_ENABLED" != "true" ]'
    );
  });

  it("uses only an ephemeral loopback Supabase runtime", () => {
    expect(workflow).toContain(
      'KLYX_GOLDEN_PATH_LOCAL_SUPABASE: "true"'
    );
    expect(workflow).toContain("supabase start");
    expect(workflow).toContain("supabase status -o env");
    expect(workflow).toContain(
      "http://127.0.0.1:54321|http://localhost:54321"
    );
    expect(workflow).toContain(
      "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
    );
    expect(workflow).toContain(
      "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
    );

    expect(workflow).not.toContain(
      "secrets.KLYX_E2E_SUPABASE_URL"
    );
    expect(workflow).not.toContain(
      "secrets.KLYX_E2E_SUPABASE_DB_URL"
    );
    expect(workflow).not.toContain(
      "secrets.KLYX_E2E_SUPABASE_DB_PASSWORD"
    );
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("--linked");

    expect(runtime).toContain("isLoopbackSupabaseUrl");
    expect(runtime).toContain('url.port === "54321"');
    expect(runtime).toContain(
      'process.env.KLYX_GOLDEN_PATH_LOCAL_SUPABASE === "true"'
    );
    expect(runtime).toContain(
      "if (!isSupabaseHost(productionUrl.hostname))"
    );
  });

  it("starts the minimum local services needed by KLYX auth and APIs", () => {
    expect(workflow).toContain(
      "-x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
    );
    expect(workflow).not.toContain("-x gotrue");
    expect(workflow).not.toContain("-x postgrest");
    expect(workflow).not.toContain("-x kong");
  });

  it("keeps the local payment harness test-shaped and secret free", () => {
    expect(workflow).toContain(
      'STRIPE_SECRET_KEY: "sk_test_klyx_golden_path_local_only"'
    );
    expect(workflow).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_klyx_golden_path_local_only"'
    );
    expect(workflow).toContain('KLYX_STRIPE_MODE: "test"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).not.toContain("secrets.KLYX_E2E_STRIPE_SECRET_KEY");
    expect(workflow).not.toContain("sk_live_");
    expect(workflow).not.toContain("pk_live_");
    expect(runtime).toContain('startsWith("sk_test_")');
    expect(runtime).toContain('startsWith("pk_test_")');
    expect(runtime).toContain('startsWith("whsec_")');
    expect(clientLifecycle).not.toContain("create-checkout-session");
  });

  it("generates account and webhook credentials per run instead of storing them", () => {
    expect(workflow).toContain(
      'golden_email="golden-path-${GITHUB_RUN_ID}@example.test"'
    );
    expect(workflow).toContain(
      'golden_password="$(openssl rand -base64 36'
    );
    expect(workflow).toContain(
      'webhook_secret="whsec_$(openssl rand -hex 32)"'
    );
    expect(workflow).toContain("::add-mask::$golden_password");
    expect(workflow).toContain("::add-mask::$webhook_secret");
    expect(workflow).not.toContain(
      "secrets.KLYX_GOLDEN_PATH_EMAIL"
    );
    expect(workflow).not.toContain(
      "secrets.KLYX_GOLDEN_PATH_PASSWORD"
    );
    expect(workflow).not.toContain(
      "secrets.KLYX_E2E_STRIPE_WEBHOOK_SECRET"
    );
  });

  it("proves the latest canonical migration is applied locally", () => {
    expect(workflow).toContain("supabase migration list --local");
    expect(workflow).toContain(
      "find supabase/migrations -maxdepth 1 -type f -name '*.sql'"
    );
    expect(workflow).toContain(
      "Latest KLYX migration ${latest_version} is not applied in local Supabase."
    );
    expect(workflow).toContain(
      "golden-path-migration-proof/proof.txt"
    );
  });

  it("bootstraps the dedicated account before the independent preflight", () => {
    const bootstrapCommand =
      "node scripts/golden-path-bootstrap.mjs";
    const preflightCommand =
      "node scripts/golden-path-preflight.mjs";

    expect(workflow).toContain(bootstrapCommand);
    expect(workflow).toContain(preflightCommand);
    expect(workflow.indexOf(bootstrapCommand)).toBeLessThan(
      workflow.indexOf(preflightCommand)
    );

    expect(bootstrap).toContain("admin.auth.admin.createUser");
    expect(bootstrap).toContain('email_confirm: true');
    expect(bootstrap).toContain('"klyx_create_profile"');
    expect(bootstrap).toContain('p_account_type: accountType');
    expect(bootstrap).toContain('country_code: "BE"');
    expect(bootstrap).toContain('currency_code: "EUR"');
  });

  it("runs a fail-closed account and catalog preflight before launch proof", () => {
    expect(preflight).toContain("assertGoldenPathIsolation");
    expect(preflight).toContain(
      '.eq("owner_user_id", user.id)'
    );
    expect(preflight).toContain(
      'profile.account_type === "client"'
    );
    expect(preflight).toContain(
      'profile.account_type === "provider"'
    );
    expect(preflight).toContain(
      'profile.country_code !== "BE"'
    );
    expect(preflight).toContain(
      'profile.currency_code !== "EUR"'
    );
    expect(preflight).toContain(
      'candidate.slug === "cleaning"'
    );
  });

  it("prepares a bookable provider only after isolation and account proof", () => {
    const preflightCommand =
      "node scripts/golden-path-preflight.mjs";
    const fixtureCommand =
      "node scripts/golden-path-provider-fixture.mjs";

    expect(workflow).toContain(fixtureCommand);
    expect(workflow.indexOf(preflightCommand)).toBeLessThan(
      workflow.indexOf(fixtureCommand)
    );

    expect(providerFixture).toContain(
      "if (!localSupabase)"
    );
    expect(providerFixture).toContain(
      'is_published: true'
    );
    expect(providerFixture).toContain(
      'provider_enabled: true'
    );
    expect(providerFixture).toContain(
      'available: true'
    );
    expect(providerFixture).toContain(
      'status: "approved"'
    );
    expect(providerFixture).toContain(
      '.from("provider_service_zones")'
    );
    expect(providerFixture).toContain(
      '.from("availability_slots")'
    );
    expect(providerFixture).toContain(
      'country_code: "BE"'
    );
    expect(providerFixture).toContain(
      'city: "Bruxelles"'
    );
  });

  it("runs the real quote-to-accepted-booking lifecycle through next start", () => {
    const fixtureCommand =
      "node scripts/golden-path-provider-fixture.mjs";
    const lifecycleCommand =
      "node scripts/golden-path-client-lifecycle.mjs";

    expect(workflow).toContain("npm run start -- -p 3100");
    expect(workflow).toContain(lifecycleCommand);
    expect(workflow.indexOf(fixtureCommand)).toBeLessThan(
      workflow.indexOf(lifecycleCommand)
    );
    expect(workflow.indexOf("Production build")).toBeLessThan(
      workflow.indexOf("Start golden path production server")
    );

    expect(clientLifecycle).toContain("if (!localSupabase)");
    expect(clientLifecycle).toContain(
      'appOrigin !== "http://127.0.0.1:3100"'
    );
    expect(clientLifecycle).toContain('path: "/api/quotes"');
    expect(clientLifecycle).toContain('action: "send"');
    expect(clientLifecycle).toContain('action: "accept"');
    expect(clientLifecycle).toContain(
      'path: "/api/bookings/create"'
    );
    expect(clientLifecycle).toContain(
      'path: "/api/bookings/status"'
    );
    expect(clientLifecycle).toContain('status: "accepted"');
    expect(clientLifecycle).toContain("expectedStatuses: [409]");
    expect(clientLifecycle).toContain(
      'booking.payment_status !== "unpaid"'
    );
    expect(clientLifecycle).toContain(
      'booking.currency !== "EUR"'
    );
  });

  it("always stops the app and destroys the ephemeral local database", () => {
    expect(workflow).toContain("Stop golden path production server");
    expect(workflow).toContain("KLYX_GOLDEN_PATH_SERVER_PID");
    expect(workflow).toContain("Destroy ephemeral local Supabase");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("supabase stop --no-backup || true");
  });
});

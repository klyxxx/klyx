import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
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

describe("KLYX golden path workflow safety", () => {
  it("is manual-only and requires explicit mutation confirmation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain(
      "KLYX_GOLDEN_PATH_MUTATIONS_ENABLED: ${{ inputs.confirm_isolated_e2e }}"
    );
    expect(workflow).toContain(
      'if [ "$KLYX_GOLDEN_PATH_MUTATIONS_ENABLED" != "true" ]'
    );
  });

  it("uses dedicated E2E Supabase secrets and rejects production reuse", () => {
    expect(workflow).toContain(
      "NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.KLYX_E2E_SUPABASE_URL }}"
    );
    expect(workflow).toContain(
      "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.KLYX_E2E_SUPABASE_SERVICE_ROLE_KEY }}"
    );
    expect(workflow).toContain(
      'if [ "$NEXT_PUBLIC_SUPABASE_URL" = "$KLYX_PRODUCTION_SUPABASE_URL" ]'
    );
    expect(workflow).toContain(
      'if (e2e.hostname === production.hostname)'
    );
    expect(runtime).toContain(
      'process.env.KLYX_GOLDEN_PATH_MUTATIONS_ENABLED !== "true"'
    );
    expect(runtime).toContain(
      "e2eUrl.hostname === productionUrl.hostname"
    );
  });

  it("hard-locks payment proof to Stripe test mode", () => {
    expect(workflow).toContain('KLYX_STRIPE_MODE: "test"');
    expect(workflow).toContain('KLYX_LIVE_PAYMENTS_ENABLED: "false"');
    expect(workflow).toContain("sk_test_*");
    expect(workflow).toContain("pk_test_*");
    expect(workflow).toContain("whsec_*");
    expect(workflow).not.toContain("sk_live_");
    expect(workflow).not.toContain("pk_live_");
    expect(runtime).toContain('startsWith("sk_test_")');
    expect(runtime).toContain('startsWith("pk_test_")');
    expect(runtime).toContain('startsWith("whsec_")');
  });

  it("uses separate golden-path credentials", () => {
    expect(workflow).toContain(
      "KLYX_E2E_EMAIL: ${{ secrets.KLYX_GOLDEN_PATH_EMAIL }}"
    );
    expect(workflow).toContain(
      "KLYX_E2E_PASSWORD: ${{ secrets.KLYX_GOLDEN_PATH_PASSWORD }}"
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
});

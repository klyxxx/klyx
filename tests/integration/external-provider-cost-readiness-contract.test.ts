import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const route = read("app/api/founder/external-costs/route.ts");
const audit = read("docs/operations/KLYX_EXTERNAL_PROVIDER_AUDIT_20260928.md");
const costControl = read("lib/providers/cost-control.ts");
const migration = read(
  "supabase/migrations/20260927162500_klyx_external_provider_usage_budget.sql"
);

const providerIds = [
  "openai",
  "supabase",
  "stripe",
  "sumsub",
  "twilio",
  "resend",
  "tolgee",
  "cloudflare_turnstile",
  "elmah_io",
  "vercel",
  "github",
] as const;

const providerLabels = [
  "OpenAI",
  "Supabase",
  "Stripe",
  "Sumsub",
  "Twilio",
  "Resend",
  "Tolgee",
  "Cloudflare Turnstile",
  "elmah.io",
  "Vercel",
  "GitHub",
] as const;

describe("KLYX external provider cost readiness contract", () => {
  it("keeps founder cost telemetry authenticated, server-side and read-only", () => {
    expect(route).toContain('import "server-only"');
    expect(route).toContain("requireKlyxFounder");
    expect(route).toContain("supabaseAdmin");
    expect(route).toContain('from("klyx_external_provider_usage_windows")');
    expect(route).toContain('telemetryKind: "internal_quota_usage"');
    expect(route).toContain("invoiceData: false");
    expect(route).toContain("not provider invoices");

    expect(route).not.toContain(".insert(");
    expect(route).not.toContain(".update(");
    expect(route).not.toContain(".delete(");
    expect(route).not.toContain(".rpc(");
    expect(route).not.toMatch(/https:\/\//);
    expect(route).not.toMatch(
      /OPENAI_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUMSUB_SECRET_KEY|TWILIO_AUTH_TOKEN|RESEND_API_KEY|ELMAH_IO_API_KEY/
    );
  });

  it("documents all eleven providers with explicit evidence quality", () => {
    for (const provider of providerLabels) {
      expect(audit).toContain(`| ${provider} |`);
    }

    expect(audit).toContain("VERIFIED_ACCOUNT");
    expect(audit).toContain("REPO_VERIFIED");
    expect(audit).toContain("BILLING_UNVERIFIED");
    expect(audit).toContain("Internal KLYX quota counters are **not provider invoices**");
    expect(audit).toContain("Supabase security finding — P1");
  });

  it("keeps every provider replaceable and paid-call mode bounded", () => {
    expect(costControl).toContain(
      'export type KlyxExternalCostMode = "zero" | "bounded"'
    );

    for (const provider of providerIds) {
      expect(costControl).toContain(`${provider}: {`);
    }

    expect(costControl).not.toContain('"unlimited"');
    expect(costControl).not.toContain('"unrestricted"');
  });

  it("keeps quota truth service-role only and atomic", () => {
    expect(migration).toContain(
      "revoke all on table public.klyx_external_provider_usage_windows from public, anon, authenticated"
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("for update");
    expect(migration).toContain("p_daily_limit = 0 or p_monthly_limit = 0");
    expect(migration).toContain("to service_role");
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX external provider cost control", () => {
  it("creates a fail-closed durable budget authority", () => {
    const migration = read(
      "supabase/migrations/20260928193000_klyx_external_provider_cost_control.sql",
    );

    expect(migration).toContain("ops_external_provider_cost_controls");
    expect(migration).toContain("ops_external_provider_cost_events");
    expect(migration).toContain("claim_external_provider_cost");
    expect(migration).toContain("CONTROL_MISSING");
    expect(migration).toContain("BUDGET_EXCEEDED");
    expect(migration).toContain("BUDGET_RESERVED");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute on function public.claim_external_provider_cost");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("('openai', 'disabled')");
    expect(migration).toContain("('sumsub', 'disabled')");
    expect(migration).toContain("('twilio', 'disabled')");
    expect(migration).toContain("('resend', 'disabled')");
  });

  it("blocks metered adapters before outbound provider calls", () => {
    const adapters = read("lib/providers/runtime-adapters.ts");

    expect(adapters).toContain('claimExternalProviderCost(\n        "sumsub"');
    expect(adapters).toContain('claimExternalProviderCost(\n        "twilio"');
    expect(adapters).toContain('claimExternalProviderCost(\n        "resend"');
    expect(adapters.indexOf('"sumsub",\n        "identity_sdk_token"')).toBeLessThan(
      adapters.indexOf("provider.createSumsubSdkToken(input)"),
    );
    expect(adapters.indexOf('"twilio",\n        "phone_otp_send"')).toBeLessThan(
      adapters.indexOf("provider.sendPhoneOtp(phoneNumber)"),
    );
    expect(adapters.indexOf('"resend",\n        "transactional_email"')).toBeLessThan(
      adapters.indexOf("provider.sendKlyxTransactionalEmail(input)"),
    );
  });

  it("gates OpenAI generation and preserves deterministic fallback", () => {
    const provider = read("lib/brain/llm/provider.ts");

    expect(provider).toContain("claimExternalProviderCost");
    expect(provider).toContain('"openai",\n        "llm_generate"');
    expect(provider.indexOf('"openai",\n        "llm_generate"')).toBeLessThan(
      provider.indexOf("this.primary.generate"),
    );
    expect(provider).toContain("DisabledKlyxLlmProvider");
    expect(provider).toContain("fallbackFrom");
  });

  it("keeps Stripe on its separate explicit financial LIVE authority", () => {
    const costControl = read("lib/providers/cost-control.ts");
    const migration = read(
      "supabase/migrations/20260928193000_klyx_external_provider_cost_control.sql",
    );

    expect(costControl).not.toContain('"stripe"');
    expect(migration).not.toContain("('stripe', 'disabled')");
  });
});

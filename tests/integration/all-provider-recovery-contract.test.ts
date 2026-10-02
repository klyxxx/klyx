import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX all-provider recovery contract", () => {
  it("keeps OpenAI bounded and preserves deterministic fallback coverage", () => {
    const openai = source("lib/brain/llm/openai-provider.ts");
    const fallback = source("tests/integration/zero-cost-brain-contract.test.ts");

    expect(openai).toContain("DEFAULT_TIMEOUT_MS");
    expect(openai).toContain("AbortController");
    expect(openai).toContain("automaticExecutionAllowed");
    expect(fallback).toContain("fallback");
    expect(fallback).toContain("OpenAI");
  });

  it("never blindly replays Twilio SMS creation but retries OTP checks", () => {
    const twilio = source("lib/twilio-verify.ts");

    expect(twilio).toContain('operation: "start_verification"');
    expect(twilio).toContain('replaySafety: "ambiguous"');
    expect(twilio).toContain('operation: "check_verification"');
    expect(twilio).toContain('replaySafety: "safe"');
    expect(twilio).toContain("timeoutMs: 8_000");
  });

  it("retries only the replay-safe Sumsub SDK token operation", () => {
    const sumsub = source("lib/sumsub.ts");

    expect(sumsub).toContain("fetchWithProviderRecovery");
    expect(sumsub).toContain('method === "GET" ? "safe" : "ambiguous"');
    expect(sumsub).toContain('path: "/resources/accessTokens/sdk"');
    expect(sumsub).toContain('replaySafety: "safe"');
  });

  it("retries Resend network delivery only under provider idempotency", () => {
    const resend = source("lib/email/resend-core.ts");
    const delivery = source("lib/email/deduplicated-delivery.ts");

    expect(resend).toContain('"Idempotency-Key"');
    expect(resend).toContain('idempotencyKey ? "idempotent" : "ambiguous"');
    expect(delivery).toContain("buildEmailProviderIdempotencyKey");
    expect(delivery).toContain("transactional_email_deliveries");
  });

  it("keeps Tolgee runtime independent from Tolgee cloud availability", () => {
    const tolgee = source("lib/klyx-tolgee-runtime.ts");

    expect(tolgee).toContain('messages/tolgee/fr.json');
    expect(tolgee).toContain('messages/tolgee/en.json');
    expect(tolgee).toContain("translateKlyxUi");
    expect(tolgee).not.toContain("fetch(");
  });

  it("keeps elmah.io observability fail-open and time bounded", () => {
    const elmah = source("lib/elmah-io.ts");

    expect(elmah).toContain("ELMAH_IO_TIMEOUT_MS");
    expect(elmah).toContain("AbortSignal.timeout");
    expect(elmah).toContain("return false");
  });

  it("keeps Cloudflare Turnstile constrained to the expected origin", () => {
    const turnstile = source("app/components/AuthTurnstile.tsx");
    const headers = source("lib/security-headers.ts");

    expect(turnstile).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    expect(headers).toContain("https://challenges.cloudflare.com");
  });

  it("removes direct RPC execution from database trigger functions without hiding intentional public provider RPCs", () => {
    const migration = source(
      "supabase/migrations/20260926213000_klyx_trigger_function_rpc_hardening.sql"
    );

    const triggerFunctions = [
      "klyx_classify_market_request_price_band",
      "klyx_financial_live_authority_events_immutable",
      "klyx_financial_live_authority_guard",
      "klyx_guard_platform_held_booking_economics",
      "klyx_guard_platform_held_ledger_economics",
      "klyx_liquidity_booking_trigger",
      "klyx_liquidity_candidate_trigger",
      "klyx_liquidity_group_booking_trigger",
      "klyx_liquidity_incident_event_trigger",
      "klyx_liquidity_offer_trigger",
      "klyx_liquidity_request_trigger",
      "klyx_mark_platform_held_booking_paid",
      "klyx_mark_platform_held_refunded",
      "klyx_market_control_events_append_only_guard",
      "klyx_mirror_booking_financial_ledger_to_central",
      "klyx_mirror_booking_settlement_to_central",
      "klyx_reject_financial_audit_mutation",
      "klyx_reject_workflow_event_mutation",
    ];

    for (const functionName of triggerFunctions) {
      expect(migration).toContain(
        `revoke execute on function public.${functionName}()`
      );
    }

    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).not.toContain("klyx_public_provider_profile");
    expect(migration).not.toContain("klyx_public_provider_service");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  KLYX_EXTERNAL_PROVIDER_COST_POLICIES,
  externalCostAlertLevel,
  getKlyxExternalCostMode,
  getKlyxExternalMeterBudget,
  isKlyxExternalMeterArmed,
} from "../../lib/providers/cost-control";

const ORIGINAL_ENV = {
  KLYX_EXTERNAL_COST_MODE: process.env.KLYX_EXTERNAL_COST_MODE,
  KLYX_COST_OPENAI_DAILY_LIMIT: process.env.KLYX_COST_OPENAI_DAILY_LIMIT,
  KLYX_COST_OPENAI_MONTHLY_LIMIT: process.env.KLYX_COST_OPENAI_MONTHLY_LIMIT,
  KLYX_COST_RESEND_DAILY_LIMIT: process.env.KLYX_COST_RESEND_DAILY_LIMIT,
  KLYX_COST_RESEND_MONTHLY_LIMIT: process.env.KLYX_COST_RESEND_MONTHLY_LIMIT,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("KLYX external cost control", () => {
  it("defaults to zero-cost mode", () => {
    delete process.env.KLYX_EXTERNAL_COST_MODE;
    expect(getKlyxExternalCostMode()).toBe("zero");

    expect(getKlyxExternalMeterBudget("openai_request")).toMatchObject({
      dailyLimit: 0,
      monthlyLimit: 0,
      automaticDisableAtLimit: true,
    });
    expect(getKlyxExternalMeterBudget("sumsub_verification_session")).toMatchObject({
      dailyLimit: 0,
      monthlyLimit: 0,
      critical: true,
    });
    expect(getKlyxExternalMeterBudget("twilio_verification_start")).toMatchObject({
      dailyLimit: 0,
      monthlyLimit: 0,
      critical: true,
    });
    expect(getKlyxExternalMeterBudget("elmah_message")).toMatchObject({
      dailyLimit: 0,
      monthlyLimit: 0,
    });
  });

  it("keeps Resend below the published free-tier quota with safety margin", () => {
    delete process.env.KLYX_EXTERNAL_COST_MODE;
    expect(getKlyxExternalMeterBudget("resend_email")).toMatchObject({
      dailyLimit: 90,
      monthlyLimit: 2700,
      automaticDisableAtLimit: true,
    });
  });

  it("requires explicit bounded mode and explicit positive limits for paid providers", () => {
    process.env.KLYX_EXTERNAL_COST_MODE = "bounded";
    process.env.KLYX_COST_OPENAI_DAILY_LIMIT = "12";
    process.env.KLYX_COST_OPENAI_MONTHLY_LIMIT = "200";

    expect(getKlyxExternalCostMode()).toBe("bounded");
    expect(getKlyxExternalMeterBudget("openai_request")).toMatchObject({
      dailyLimit: 12,
      monthlyLimit: 200,
    });
    expect(isKlyxExternalMeterArmed("openai_request")).toBe(true);
  });

  it("ignores paid-provider limits while zero mode is active", () => {
    process.env.KLYX_EXTERNAL_COST_MODE = "zero";
    process.env.KLYX_COST_OPENAI_DAILY_LIMIT = "999999";
    process.env.KLYX_COST_OPENAI_MONTHLY_LIMIT = "999999";

    expect(isKlyxExternalMeterArmed("openai_request")).toBe(false);
  });

  it("emits deterministic 50/80/100 percent alert levels", () => {
    expect(externalCostAlertLevel(4, 10)).toBe(0);
    expect(externalCostAlertLevel(5, 10)).toBe(50);
    expect(externalCostAlertLevel(8, 10)).toBe(80);
    expect(externalCostAlertLevel(10, 10)).toBe(100);
    expect(externalCostAlertLevel(11, 10)).toBe(100);
  });

  it("covers every governed external provider without granting business authority", () => {
    expect(Object.keys(KLYX_EXTERNAL_PROVIDER_COST_POLICIES).sort()).toEqual(
      [
        "cloudflare_turnstile",
        "elmah_io",
        "github",
        "openai",
        "resend",
        "stripe",
        "sumsub",
        "supabase",
        "tolgee",
        "twilio",
        "vercel",
      ]
    );

    expect(KLYX_EXTERNAL_PROVIDER_COST_POLICIES.stripe.zeroBudgetBehavior).toBe(
      "test_only"
    );
    expect(KLYX_EXTERNAL_PROVIDER_COST_POLICIES.openai.zeroBudgetBehavior).toBe(
      "degrade"
    );
    expect(KLYX_EXTERNAL_PROVIDER_COST_POLICIES.sumsub.zeroBudgetBehavior).toBe(
      "block"
    );
  });
});

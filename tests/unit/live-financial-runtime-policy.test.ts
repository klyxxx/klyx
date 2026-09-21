import { describe, expect, it } from "vitest";

import {
  assertLiveFinancialStaticGate,
  inspectLiveFinancialStaticGate,
  KLYX_LIVE_FINANCIAL_NOT_ARMED,
  KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY,
  KLYX_LIVE_FINANCIAL_SHA_MISMATCH,
  type LiveFinancialEnvironment,
} from "@/lib/live-financial-runtime-policy";

const SHA = "c93145096ba7eec81543cc17ecb776356ee5c59b";
const OTHER_SHA = "d93145096ba7eec81543cc17ecb776356ee5c59b";

function armedLiveEnvironment(
  overrides: LiveFinancialEnvironment = {}
): LiveFinancialEnvironment {
  return {
    KLYX_STRIPE_MODE: "live",
    KLYX_LIVE_PAYMENTS_ENABLED: "true",
    KLYX_LIVE_FINANCIAL_STATE: "armed",
    KLYX_LIVE_CERTIFIED_SHA: SHA,
    KLYX_DEPLOYED_SHA: SHA,
    KLYX_LIVE_WEBHOOKS_READY: "true",
    KLYX_LIVE_CONNECT_READY: "true",
    KLYX_LIVE_CRITICAL_ALERTS_READY: "true",
    KLYX_LIVE_DURABLE_JOBS_READY: "true",
    KLYX_LIVE_LEDGER_READY: "true",
    KLYX_LIVE_ECONOMIC_ELIGIBILITY_REQUIRED: "true",
    KLYX_LIVE_RECONCILIATION_READY: "true",
    KLYX_SETTLEMENT_CONTROL_LIVE_READY: "true",
    ...overrides,
  };
}

describe("KLYX LIVE financial runtime policy", () => {
  it("keeps TEST outside the LIVE arming contract", () => {
    expect(
      inspectLiveFinancialStaticGate({
        KLYX_STRIPE_MODE: "test",
      })
    ).toMatchObject({
      mode: "test",
      armed: false,
      ready: true,
    });
  });

  it("does not let the legacy live-payments flag implicitly arm LIVE", () => {
    const env: LiveFinancialEnvironment = {
      KLYX_STRIPE_MODE: "live",
      KLYX_LIVE_PAYMENTS_ENABLED: "true",
    };

    expect(inspectLiveFinancialStaticGate(env).ready).toBe(false);
    expect(() => assertLiveFinancialStaticGate(env)).toThrow(
      KLYX_LIVE_FINANCIAL_NOT_ARMED
    );
  });

  it("fails closed when deployed SHA differs from certified SHA", () => {
    const env = armedLiveEnvironment({
      KLYX_DEPLOYED_SHA: OTHER_SHA,
    });

    expect(inspectLiveFinancialStaticGate(env).ready).toBe(false);
    expect(() => assertLiveFinancialStaticGate(env)).toThrow(
      KLYX_LIVE_FINANCIAL_SHA_MISMATCH
    );
  });

  it("requires every readiness proof even when master state and SHA match", () => {
    const env = armedLiveEnvironment({
      KLYX_LIVE_DURABLE_JOBS_READY: "false",
    });

    expect(inspectLiveFinancialStaticGate(env).ready).toBe(false);
    expect(() => assertLiveFinancialStaticGate(env)).toThrow(
      KLYX_LIVE_FINANCIAL_RUNTIME_NOT_READY
    );
  });

  it("authorizes the static LIVE boundary only when every proof is explicit", () => {
    const report = assertLiveFinancialStaticGate(
      armedLiveEnvironment()
    );

    expect(report.ready).toBe(true);
    expect(report.armed).toBe(true);
    expect(report.certifiedSha).toBe(SHA);
    expect(report.deployedSha).toBe(SHA);
    expect(report.checks.every((check) => check.ok)).toBe(true);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { isKlyxElmahHeartbeatConfigured } from "../../lib/elmah-io";

const originalEnv = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  ELMAH_IO_API_KEY: process.env.ELMAH_IO_API_KEY,
  ELMAH_IO_HEARTBEAT_ID: process.env.ELMAH_IO_HEARTBEAT_ID,
  KLYX_EXTERNAL_COST_MODE: process.env.KLYX_EXTERNAL_COST_MODE,
  KLYX_PROVIDER_ELMAH_IO_ENABLED:
    process.env.KLYX_PROVIDER_ELMAH_IO_ENABLED,
  KLYX_PROVIDER_ELMAH_IO_SPEND_CAP_CONFIRMED:
    process.env.KLYX_PROVIDER_ELMAH_IO_SPEND_CAP_CONFIRMED,
  KLYX_PROVIDER_ELMAH_IO_MONTHLY_BUDGET_MINOR:
    process.env.KLYX_PROVIDER_ELMAH_IO_MONTHLY_BUDGET_MINOR,
};

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function configureProductionHeartbeat(heartbeatId: string): void {
  process.env.VERCEL_ENV = "production";
  process.env.ELMAH_IO_API_KEY = "test-api-key";
  process.env.ELMAH_IO_HEARTBEAT_ID = heartbeatId;
  process.env.KLYX_EXTERNAL_COST_MODE = "guarded";
  process.env.KLYX_PROVIDER_ELMAH_IO_ENABLED = "1";
  process.env.KLYX_PROVIDER_ELMAH_IO_SPEND_CAP_CONFIRMED = "1";
  process.env.KLYX_PROVIDER_ELMAH_IO_MONTHLY_BUDGET_MINOR = "1";
}

afterEach(() => {
  restoreEnv("VERCEL_ENV");
  restoreEnv("ELMAH_IO_API_KEY");
  restoreEnv("ELMAH_IO_HEARTBEAT_ID");
  restoreEnv("KLYX_EXTERNAL_COST_MODE");
  restoreEnv("KLYX_PROVIDER_ELMAH_IO_ENABLED");
  restoreEnv("KLYX_PROVIDER_ELMAH_IO_SPEND_CAP_CONFIRMED");
  restoreEnv("KLYX_PROVIDER_ELMAH_IO_MONTHLY_BUDGET_MINOR");
});

describe("elmah.io heartbeat id validation", () => {
  it("accepts the compact 32-hex heartbeat id format returned by elmah.io", () => {
    configureProductionHeartbeat("76192a408ce14643858b755c0d3f69c6");

    expect(isKlyxElmahHeartbeatConfigured()).toBe(true);
  });

  it("keeps accepting canonical hyphenated ids", () => {
    configureProductionHeartbeat("76192a40-8ce1-4643-858b-755c0d3f69c6");

    expect(isKlyxElmahHeartbeatConfigured()).toBe(true);
  });

  it("rejects path-like or malformed heartbeat ids", () => {
    configureProductionHeartbeat("../../heartbeat");

    expect(isKlyxElmahHeartbeatConfigured()).toBe(false);
  });
});

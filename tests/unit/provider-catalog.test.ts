import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_CATALOG,
  getKlyxProviderDescriptor,
} from "../../lib/providers/catalog";
import { KLYX_PROVIDER_IDS } from "../../lib/providers/contracts";

describe("KLYX external provider catalog", () => {
  it("registers every canonical external provider exactly once", () => {
    expect(KLYX_PROVIDER_CATALOG.map((provider) => provider.id)).toEqual(
      KLYX_PROVIDER_IDS
    );
    expect(new Set(KLYX_PROVIDER_CATALOG.map((provider) => provider.id)).size).toBe(
      KLYX_PROVIDER_IDS.length
    );
  });

  it("never classifies a server secret as a public browser variable", () => {
    for (const provider of KLYX_PROVIDER_CATALOG) {
      for (const secret of provider.secretEnvironmentVariables) {
        expect(secret.startsWith("NEXT_PUBLIC_")).toBe(false);
        expect(provider.publicEnvironmentVariables).not.toContain(secret);
      }
    }
  });

  it("keeps financial and identity providers fail-closed", () => {
    expect(getKlyxProviderDescriptor("stripe").failureMode).toBe("fail-closed");
    expect(getKlyxProviderDescriptor("sumsub").failureMode).toBe("fail-closed");
    expect(getKlyxProviderDescriptor("twilio").failureMode).toBe("fail-closed");
  });

  it("keeps observability non-authoritative and translations offline-capable", () => {
    expect(getKlyxProviderDescriptor("elmah").failureMode).toBe("fail-open");
    expect(getKlyxProviderDescriptor("tolgee").failureMode).toBe(
      "offline-snapshot"
    );
  });

  it("permits browser exposure only for explicit public/RLS bounded surfaces", () => {
    for (const provider of KLYX_PROVIDER_CATALOG) {
      if (provider.clientExposure === "none") continue;

      expect(["supabase", "sumsub", "turnstile"]).toContain(provider.id);
    }

    expect(getKlyxProviderDescriptor("supabase").clientExposure).toBe(
      "publishable-rls-bounded"
    );
    expect(getKlyxProviderDescriptor("sumsub").clientExposure).toBe(
      "public-sdk-tokenized"
    );
    expect(getKlyxProviderDescriptor("turnstile").clientExposure).toBe(
      "public-widget"
    );
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  {
    route: "app/api/profile/phone/otp/send/route.ts",
    core: "app/api/profile/phone/otp/send/otp-send-route-core.ts",
    marker: "KLYX_PHONE_OTP_SEND_SECURITY_12_71",
    code: "KLYX_PROFILE_PHONE_OTP_SEND_FAILED",
  },
  {
    route: "app/api/profile/phone/otp/verify/route.ts",
    core: "app/api/profile/phone/otp/verify/otp-verify-route-core.ts",
    marker: "KLYX_PHONE_OTP_VERIFY_SECURITY_12_71",
    code: "KLYX_PROFILE_PHONE_OTP_VERIFY_FAILED",
  },
  {
    route: "app/api/profile/phone/privacy/route.ts",
    core: "app/api/profile/phone/privacy/phone-privacy-route-core.ts",
    marker: "KLYX_PHONE_PRIVACY_API_12_75",
    code: "KLYX_PROFILE_PHONE_PRIVACY_REQUEST_FAILED",
  },
  {
    route: "app/api/profile/phone/access-history/route.ts",
    core: "app/api/profile/phone/access-history/phone-access-history-route-core.ts",
    marker: "KLYX_PHONE_ACCESS_HISTORY_API_12_76",
    code: "KLYX_PROFILE_PHONE_ACCESS_HISTORY_FAILED",
  },
] as const;

describe("profile phone API error sanitization contract", () => {
  for (const item of routes) {
    it(`secures ${item.route} while retaining its original core`, () => {
      const routeSource = readFileSync(join(process.cwd(), item.route), "utf8");
      const coreSource = readFileSync(join(process.cwd(), item.core), "utf8");

      expect(routeSource).toContain("secureApiErrorResponse");
      expect(routeSource).toContain(item.code);
      expect(routeSource).toContain("response.status < 500");
      expect(routeSource).not.toContain("{ error: message }");
      expect(coreSource).toContain(item.marker);
    });
  }

  it("keeps OTP throttling and privacy/access-history semantics in the exact cores", () => {
    const sendCore = readFileSync(
      join(process.cwd(), "app/api/profile/phone/otp/send/otp-send-route-core.ts"),
      "utf8"
    );
    const verifyCore = readFileSync(
      join(process.cwd(), "app/api/profile/phone/otp/verify/otp-verify-route-core.ts"),
      "utf8"
    );
    const privacyCore = readFileSync(
      join(process.cwd(), "app/api/profile/phone/privacy/phone-privacy-route-core.ts"),
      "utf8"
    );
    const historyCore = readFileSync(
      join(process.cwd(), "app/api/profile/phone/access-history/phone-access-history-route-core.ts"),
      "utf8"
    );

    expect(sendCore).toContain("SEND_COOLDOWN_SECONDS = 60");
    expect(sendCore).toContain("phone_verification_limits");
    expect(verifyCore).toContain("MAX_FAILED_ATTEMPTS = 5");
    expect(verifyCore).toContain("LOCK_MINUTES = 15");
    expect(privacyCore).toContain('"transaction_participants"');
    expect(historyCore).toContain("phone_contact_access_logs");
  });
});

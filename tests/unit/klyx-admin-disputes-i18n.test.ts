import { describe, expect, it } from "vitest";
import {
  KLYX_ADMIN_DISPUTES_MESSAGE_KEYS,
  KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES,
  getKlyxAdminDisputesIntlLocale,
  resolveKlyxAdminDisputesLocale,
  translateKlyxAdminBookingStatus,
  translateKlyxAdminDisputeDecision,
  translateKlyxAdminDisputes,
  translateKlyxAdminPaymentStatus,
  translateKlyxAdminPriority,
} from "../../lib/klyx-admin-disputes-i18n";

describe("KLYX admin disputes i18n", () => {
  it("has complete FR/EN/NL/DE dictionaries", () => {
    for (const locale of KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES) {
      for (const key of KLYX_ADMIN_DISPUTES_MESSAGE_KEYS) {
        expect(translateKlyxAdminDisputes(locale, key)).toBeTruthy();
      }
    }
  });

  it("falls back explicitly to French", () => {
    expect(resolveKlyxAdminDisputesLocale("es")).toBe("fr");
    expect(translateKlyxAdminDisputes("es", "title")).toBe(
      translateKlyxAdminDisputes("fr", "title")
    );
    expect(getKlyxAdminDisputesIntlLocale("es")).toBe("fr-BE");
  });

  it("localizes decisions without changing identifiers", () => {
    for (const locale of KLYX_ADMIN_DISPUTES_TRANSLATED_LOCALES) {
      expect(translateKlyxAdminDisputeDecision(locale, "no_action")).toBeTruthy();
      expect(
        translateKlyxAdminDisputeDecision(locale, "refund_review_required")
      ).toBeTruthy();
      expect(translateKlyxAdminDisputeDecision(locale, "")).toBeTruthy();
    }
  });

  it("does not expose unknown raw booking, payment, priority, or decision codes", () => {
    const unknown = "future_internal_code_123";

    expect(translateKlyxAdminBookingStatus("en", unknown)).not.toContain(unknown);
    expect(translateKlyxAdminPaymentStatus("nl", unknown)).not.toContain(unknown);
    expect(translateKlyxAdminPriority("de", unknown)).not.toContain(unknown);
    expect(translateKlyxAdminDisputeDecision("fr", unknown)).not.toContain(unknown);
  });
});

import { describe, expect, it } from "vitest";

import {
  KLYX_PROVIDER_VERIFICATION_MESSAGE_KEYS,
  formatKlyxProviderVerificationFileSize,
  getKlyxProviderVerificationDocumentType,
  resolveKlyxProviderVerificationLocale,
  translateKlyxProviderVerification,
  translateKlyxProviderVerificationStatus,
} from "@/lib/klyx-provider-verification-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;
const DOCUMENT_TYPES = [
  "identity",
  "address",
  "business",
  "insurance",
  "professional_certificate",
] as const;
const STATUSES = [
  "not_started",
  "incomplete",
  "submitted",
  "under_review",
  "approved",
  "changes_required",
  "rejected",
  "missing",
  "optional",
  "uploaded",
] as const;

describe("KLYX provider verification i18n", () => {
  it("has a complete non-empty dictionary in every certified locale", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KLYX_PROVIDER_VERIFICATION_MESSAGE_KEYS) {
        expect(
          translateKlyxProviderVerification(locale, key).trim()
        ).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside verification certification", () => {
    expect(resolveKlyxProviderVerificationLocale("fr")).toBe("fr");
    expect(resolveKlyxProviderVerificationLocale("en")).toBe("en");
    expect(resolveKlyxProviderVerificationLocale("nl")).toBe("nl");
    expect(resolveKlyxProviderVerificationLocale("de")).toBe("de");
    expect(resolveKlyxProviderVerificationLocale("es")).toBe("fr");
    expect(
      translateKlyxProviderVerification("es", "title")
    ).toBe(translateKlyxProviderVerification("fr", "title"));
  });

  it("localizes every controlled verification document type", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const type of DOCUMENT_TYPES) {
        const copy = getKlyxProviderVerificationDocumentType(
          locale,
          type
        );
        expect(copy?.title.trim()).not.toBe("");
        expect(copy?.description.trim()).not.toBe("");
      }
    }
  });

  it("localizes known statuses while preserving future identifiers", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const status of STATUSES) {
        expect(
          translateKlyxProviderVerificationStatus(locale, status).trim()
        ).not.toBe("");
      }
    }

    expect(
      translateKlyxProviderVerificationStatus(
        "en",
        "future_verification_status"
      )
    ).toBe("future_verification_status");
  });

  it("formats file sizes without exposing raw byte counts", () => {
    for (const locale of CERTIFIED_LOCALES) {
      const formatted = formatKlyxProviderVerificationFileSize(
        locale,
        2048
      );
      expect(formatted).toContain("2");
      expect(formatted).toContain("KB");
    }
  });
});

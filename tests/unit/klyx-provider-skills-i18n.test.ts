import { describe, expect, it } from "vitest";

import {
  formatKlyxProviderSkillMinimumYears,
  KLYX_PROVIDER_SKILLS_MESSAGE_KEYS,
  resolveKlyxProviderSkillsLocale,
  translateKlyxProviderSkillDocumentStatus,
  translateKlyxProviderSkillProofType,
  translateKlyxProviderSkills,
  translateKlyxProviderSkillStatus,
} from "@/lib/klyx-provider-skills-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

describe("KLYX provider skills i18n", () => {
  it("has a complete non-empty dictionary in every certified locale", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KLYX_PROVIDER_SKILLS_MESSAGE_KEYS) {
        expect(translateKlyxProviderSkills(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside provider-skills certification", () => {
    expect(resolveKlyxProviderSkillsLocale("fr")).toBe("fr");
    expect(resolveKlyxProviderSkillsLocale("en")).toBe("en");
    expect(resolveKlyxProviderSkillsLocale("nl")).toBe("nl");
    expect(resolveKlyxProviderSkillsLocale("de")).toBe("de");
    expect(resolveKlyxProviderSkillsLocale("es")).toBe("fr");
    expect(translateKlyxProviderSkills("es", "title")).toBe(
      translateKlyxProviderSkills("fr", "title")
    );
  });

  it("localizes known verification and document statuses while preserving future identifiers", () => {
    expect(translateKlyxProviderSkillStatus("fr", "approved")).toBe(
      "Compétence vérifiée"
    );
    expect(translateKlyxProviderSkillStatus("en", "under_review")).toBe(
      "Under review"
    );
    expect(translateKlyxProviderSkillStatus("nl", "submitted")).toBe(
      "Ingediend"
    );
    expect(translateKlyxProviderSkillStatus("de", "changes_required")).toBe(
      "Korrekturen erforderlich"
    );
    expect(translateKlyxProviderSkillStatus("en", "future_status")).toBe(
      "future_status"
    );

    expect(translateKlyxProviderSkillDocumentStatus("fr", "uploaded")).toBe(
      "Envoyé"
    );
    expect(translateKlyxProviderSkillDocumentStatus("de", "approved")).toBe(
      "Genehmigt"
    );
    expect(
      translateKlyxProviderSkillDocumentStatus("nl", "future_document_status")
    ).toBe("future_document_status");
  });

  it("localizes only known proof identifiers and preserves unknown future proof types", () => {
    expect(translateKlyxProviderSkillProofType("fr", "diploma")).toBe("Diplôme");
    expect(
      translateKlyxProviderSkillProofType("en", "training_certificate")
    ).toBe("Training certificate");
    expect(translateKlyxProviderSkillProofType("nl", "insurance")).toBe(
      "Beroepsverzekering"
    );
    expect(
      translateKlyxProviderSkillProofType("de", "professional_license")
    ).toBe("Berufslizenz oder Genehmigung");
    expect(translateKlyxProviderSkillProofType("en", "future_proof")).toBe(
      "future_proof"
    );
  });

  it("formats minimum experience without changing the numeric requirement", () => {
    expect(formatKlyxProviderSkillMinimumYears("fr", 1)).toContain("1");
    expect(formatKlyxProviderSkillMinimumYears("en", 2)).toContain("2");
    expect(formatKlyxProviderSkillMinimumYears("nl", 3)).toContain("3");
    expect(formatKlyxProviderSkillMinimumYears("de", 4)).toContain("4");
  });
});

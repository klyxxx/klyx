import { describe, expect, it } from "vitest";

import {
  getKlyxProviderServiceProposalCategoryLabel,
  KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES,
  KLYX_PROVIDER_SERVICE_PROPOSALS_MESSAGE_KEYS,
  resolveKlyxProviderServiceProposalsLocale,
  translateKlyxProviderServiceProposals,
  translateKlyxProviderServiceProposalStatus,
} from "@/lib/klyx-provider-service-proposals-i18n";

const CERTIFIED_LOCALES = ["fr", "en", "nl", "de"] as const;

const CANONICAL_CATEGORIES = [
  "Maison et entretien",
  "Famille et garde",
  "Transport et déménagement",
  "Beauté et bien-être",
  "Cours et accompagnement",
  "Événementiel",
  "Animaux",
  "Numérique et création",
  "Réparation et technique",
  "Autre service",
] as const;

describe("KLYX provider service proposals i18n", () => {
  it("has a complete non-empty dictionary in every certified locale", () => {
    for (const locale of CERTIFIED_LOCALES) {
      for (const key of KLYX_PROVIDER_SERVICE_PROPOSALS_MESSAGE_KEYS) {
        expect(translateKlyxProviderServiceProposals(locale, key).trim()).not.toBe(
          ""
        );
      }
    }
  });

  it("uses explicit French fallback outside this certification", () => {
    expect(resolveKlyxProviderServiceProposalsLocale("fr")).toBe("fr");
    expect(resolveKlyxProviderServiceProposalsLocale("en")).toBe("en");
    expect(resolveKlyxProviderServiceProposalsLocale("nl")).toBe("nl");
    expect(resolveKlyxProviderServiceProposalsLocale("de")).toBe("de");
    expect(resolveKlyxProviderServiceProposalsLocale("es")).toBe("fr");
    expect(translateKlyxProviderServiceProposals("es", "title")).toBe(
      translateKlyxProviderServiceProposals("fr", "title")
    );
  });

  it("keeps canonical moderation category values exactly unchanged", () => {
    expect(KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES).toEqual(
      CANONICAL_CATEGORIES
    );

    for (const category of CANONICAL_CATEGORIES) {
      expect(getKlyxProviderServiceProposalCategoryLabel("fr", category)).toBe(
        category
      );
    }

    expect(
      getKlyxProviderServiceProposalCategoryLabel("en", "Maison et entretien")
    ).toBe("Home and maintenance");
    expect(
      getKlyxProviderServiceProposalCategoryLabel("nl", "Famille et garde")
    ).toBe("Gezin en opvang");
    expect(
      getKlyxProviderServiceProposalCategoryLabel(
        "de",
        "Réparation et technique"
      )
    ).toBe("Reparatur und Technik");
  });

  it("keeps unknown stored categories verbatim", () => {
    expect(
      getKlyxProviderServiceProposalCategoryLabel(
        "en",
        "Future canonical category"
      )
    ).toBe("Future canonical category");
  });

  it("localizes known statuses without exposing unknown backend status text", () => {
    expect(translateKlyxProviderServiceProposalStatus("en", "pending")).toBe(
      "Under review"
    );
    expect(translateKlyxProviderServiceProposalStatus("nl", "approved")).toBe(
      "Goedgekeurd"
    );
    expect(translateKlyxProviderServiceProposalStatus("de", "rejected")).toBe(
      "Abgelehnt"
    );
    expect(
      translateKlyxProviderServiceProposalStatus("en", "future_status")
    ).toBe(translateKlyxProviderServiceProposals("en", "statusUnknown"));
  });
});

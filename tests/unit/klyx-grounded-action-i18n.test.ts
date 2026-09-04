import { describe, expect, it } from "vitest";

import {
  KLYX_GROUNDED_ACTION_LOCALES,
  localizeKlyxGroundedAction,
  resolveKlyxGroundedActionLocale,
} from "@/lib/klyx-grounded-action-i18n";

function action(overrides: Partial<{
  kind: string;
  title: string;
  description: string;
  label: string;
}> = {}) {
  return {
    id: "action-1",
    kind: "track_mission",
    priority: 100,
    title: "Le prestataire est en route",
    description: "Le prestataire est en route. Suis la mission depuis KLYX.",
    href: "/tracking/booking-1",
    label: "Suivre la mission",
    ...overrides,
  };
}

describe("KLYX grounded action i18n", () => {
  it("certifies FR/EN/NL/DE and falls back to French", () => {
    expect(KLYX_GROUNDED_ACTION_LOCALES).toEqual(["fr", "en", "nl", "de"]);
    expect(resolveKlyxGroundedActionLocale("es")).toBe("fr");
  });

  it("localizes a grounded client mission without changing action identity or href", () => {
    const localized = localizeKlyxGroundedAction(action(), "en");

    expect(localized.title).toBe("The provider is on the way");
    expect(localized.description).toBe(
      "The provider is on the way. Track the mission in KLYX."
    );
    expect(localized.label).toBe("Track the mission");
    expect(localized.id).toBe("action-1");
    expect(localized.href).toBe("/tracking/booking-1");
    expect(localized.priority).toBe(100);
  });

  it("localizes dynamic offer counts deterministically", () => {
    const localized = localizeKlyxGroundedAction(
      action({
        kind: "compare_offers",
        title: "2 offres a comparer",
        description: "Besoin de ménage vendredi",
        label: "Comparer avec KLYX",
      }),
      "nl"
    );

    expect(localized.title).toBe("2 offertes vergelijken");
    expect(localized.description).toBe("Besoin de ménage vendredi");
    expect(localized.label).toBe("Vergelijken met KLYX");
  });

  it("localizes provider accepted amounts while preserving the server amount", () => {
    const localized = localizeKlyxGroundedAction(
      action({
        kind: "provider_offer_update",
        title: "Une offre a ete acceptee",
        description: "Montant accepte : 42.50 EUR.",
        label: "Voir mes reservations",
      }),
      "de"
    );

    expect(localized.title).toBe("Ein Angebot wurde angenommen");
    expect(localized.description).toBe("Angenommener Betrag: 42.50 EUR.");
    expect(localized.label).toBe("Meine Buchungen ansehen");
  });

  it("keeps unknown trusted server copy unchanged", () => {
    const source = action({
      title: "Trusted future title",
      description: "Trusted future description",
      label: "Trusted future CTA",
    });

    expect(localizeKlyxGroundedAction(source, "en")).toEqual(source);
  });
});

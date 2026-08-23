import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_SPLIT_MISSION_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_TRANSLATED_LOCALES,
  formatKlyxSplitMissionAdditionalSlots,
  formatKlyxSplitMissionService,
  formatKlyxSplitMissionSlotCount,
  formatKlyxSplitMissionStatus,
  formatKlyxSplitMissionSummary,
  resolveKlyxSplitMissionLocale,
  translateKlyxSplitMission,
} from "@/lib/klyx-split-mission-i18n";

describe("KLYX split mission i18n", () => {
  it("keeps all certified dictionaries complete", () => {
    for (const locale of KLYX_SPLIT_MISSION_TRANSLATED_LOCALES) {
      for (const key of KLYX_SPLIT_MISSION_MESSAGE_KEYS) {
        expect(translateKlyxSplitMission(locale, key).trim()).not.toBe("");
      }
    }
  });

  it("uses explicit French fallback outside certified page locales", () => {
    expect(resolveKlyxSplitMissionLocale("es")).toBe("fr");
    expect(translateKlyxSplitMission("es", "viewMission")).toBe(
      "Voir la mission complète"
    );
  });

  it("translates stable mission states and built-in service slugs", () => {
    expect(formatKlyxSplitMissionStatus("en", "recovery_required")).toBe(
      "Review required"
    );
    expect(formatKlyxSplitMissionStatus("nl", "completed")).toBe("Voltooid");
    expect(formatKlyxSplitMissionService("de", "cleaning", "Ménage")).toBe(
      "Reinigung"
    );
    expect(
      formatKlyxSplitMissionService("en", "menage-a-domicile", "Ménage")
    ).toBe("Cleaning");
    expect(
      formatKlyxSplitMissionService("en", "custom-service", "Plomberie")
    ).toBe("Plomberie");
  });

  it("localizes slot counts and summaries without changing numeric values", () => {
    expect(formatKlyxSplitMissionSlotCount("fr", 2)).toBe("2 créneaux");
    expect(formatKlyxSplitMissionSlotCount("en", 1)).toBe("1 time slot");
    expect(formatKlyxSplitMissionSummary("de", 3)).toBe(
      "Ein Auftrag · 3 Zeitfenster"
    );
    expect(formatKlyxSplitMissionAdditionalSlots("nl", 2)).toBe(
      "+ 2 andere tijdsloten"
    );
  });
});

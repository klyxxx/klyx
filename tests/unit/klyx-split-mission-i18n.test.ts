import {
  describe,
  expect,
  it,
} from "vitest";

import {
  KLYX_SPLIT_MISSION_MESSAGE_KEYS,
  KLYX_SPLIT_MISSION_TRANSLATED_LOCALES,
  formatKlyxSplitBookingStatus,
  formatKlyxSplitMissionAdditionalSlots,
  formatKlyxSplitMissionDetailDate,
  formatKlyxSplitMissionProviderCount,
  formatKlyxSplitMissionService,
  formatKlyxSplitMissionSlotCount,
  formatKlyxSplitMissionSlotPosition,
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
    expect(translateKlyxSplitMission("es", "detailRefresh")).toBe(
      "Actualiser"
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

  it("localizes detail counts, positions and known booking states", () => {
    expect(formatKlyxSplitMissionProviderCount("fr", 2)).toBe(
      "2 prestataires"
    );
    expect(formatKlyxSplitMissionProviderCount("en", 1)).toBe("1 provider");
    expect(formatKlyxSplitMissionSlotPosition("nl", 4)).toBe("Tijdslot 4");
    expect(formatKlyxSplitBookingStatus("de", "accepted")).toBe("Angenommen");
    expect(formatKlyxSplitBookingStatus("en", "missing")).toBe(
      "Booking missing"
    );
    expect(formatKlyxSplitBookingStatus("en", "custom_state")).toBe(
      "custom_state"
    );
  });

  it("formats detail dates with the certified locale and explicit French fallback", () => {
    expect(formatKlyxSplitMissionDetailDate("en", "2026-08-23")).toContain(
      "2026"
    );
    expect(formatKlyxSplitMissionDetailDate("nl", "2026-08-23")).toContain(
      "2026"
    );
    expect(formatKlyxSplitMissionDetailDate("es", "2026-08-23")).toBe(
      formatKlyxSplitMissionDetailDate("fr", "2026-08-23")
    );
  });
});

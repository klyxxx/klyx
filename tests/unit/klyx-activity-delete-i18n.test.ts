import { describe, expect, it } from "vitest";

import {
  KLYX_ACTIVITY_DELETE_LOCALES,
  translateKlyxActivityDelete,
} from "@/lib/klyx-activity-delete-i18n";

describe("KLYX Activity delete i18n", () => {
  it("covers every supported Activity locale", () => {
    expect(KLYX_ACTIVITY_DELETE_LOCALES).toEqual(["fr", "en", "nl", "de"]);

    for (const locale of KLYX_ACTIVITY_DELETE_LOCALES) {
      expect(translateKlyxActivityDelete(locale, "delete").trim()).not.toBe("");
      expect(translateKlyxActivityDelete(locale, "confirm")).toMatch(/\?/);
      expect(translateKlyxActivityDelete(locale, "failed").trim()).not.toBe("");
    }
  });

  it("falls back deterministically to French", () => {
    expect(translateKlyxActivityDelete("es", "delete")).toBe("Supprimer");
    expect(translateKlyxActivityDelete(undefined, "delete")).toBe("Supprimer");
  });

  it("states that deletion keeps financial source records", () => {
    expect(translateKlyxActivityDelete("fr", "confirm")).toContain("paiement");
    expect(translateKlyxActivityDelete("en", "confirm")).toContain("payment");
  });
});

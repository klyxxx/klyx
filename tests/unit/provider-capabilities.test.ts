import { describe, expect, it } from "vitest";

import {
  isValidKlyxProviderCapabilityLabel,
  normalizeKlyxProviderCapabilityLabel,
} from "@/lib/provider-capabilities";

describe("KLYX provider capabilities", () => {
  it("normalizes accents and punctuation without turning a capability into a catalog slug", () => {
    expect(
      normalizeKlyxProviderCapabilityLabel(" Réparer des PC & monter des meubles ")
    ).toBe("reparer des pc monter des meubles");
  });

  it("preserves non-Latin scripts for international capabilities", () => {
    expect(normalizeKlyxProviderCapabilityLabel("犬の散歩")).toBe("犬の散歩");
    expect(normalizeKlyxProviderCapabilityLabel("إصلاح الحاسوب")).toBe(
      "اصلاح الحاسوب"
    );
  });

  it("accepts useful free-form capability labels and rejects empty noise", () => {
    expect(isValidKlyxProviderCapabilityLabel("Monter des meubles")).toBe(true);
    expect(isValidKlyxProviderCapabilityLabel("犬の散歩")).toBe(true);
    expect(isValidKlyxProviderCapabilityLabel("!!!")).toBe(false);
    expect(isValidKlyxProviderCapabilityLabel(" ")).toBe(false);
  });
});

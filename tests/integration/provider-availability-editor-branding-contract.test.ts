import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/AvailabilityEditor.tsx"),
  "utf8"
);

describe("provider availability editor branding contract", () => {
  it("uses the exact KLYX blue for normal availability accents", () => {
    expect(source).toContain("text-[#2563EB]");
    expect(source).toContain("accent-[#2563EB]");
    expect(source).toContain("focus:border-[#2563EB]");
    expect(source).toContain("bg-[#2563EB]");

    for (const legacyClass of [
      "text-violet-",
      "bg-violet-",
      "border-violet-",
      "accent-violet-",
      "text-indigo-",
      "bg-indigo-",
    ]) {
      expect(source).not.toContain(legacyClass);
    }
  });

  it("preserves semantic error and success colors", () => {
    expect(source).toContain("red-500");
    expect(source).toContain("emerald-500");
  });

  it("uses the shared locale provider instead of hard-coded weekday copy", () => {
    expect(source).toContain("useKlyxLocale");
    expect(source).toContain("translateKlyxProviderAvailabilityDay");
    expect(source).not.toContain('{ value: 1, label: "Lundi" }');
    expect(source).not.toContain('>Disponibilités hebdomadaires</h2>');
  });
});

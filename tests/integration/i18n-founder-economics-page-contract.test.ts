import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder economics i18n contract", () => {
  it("localizes presentation without introducing network or payment behavior", () => {
    const page = read("app/founder/economics/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_ECONOMICS_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).not.toContain("fetch(");
    expect(page).not.toContain("stripe");
    expect(page).not.toContain("PaymentIntent");
    expect(page).not.toContain("CheckoutSession");
  });

  it("preserves default commission and exact local calculator formulas", () => {
    const page = read("app/founder/economics/page.tsx");
    expect(page).toContain("const DEFAULT_PERCENT = 15");
    expect(page).toContain("const platform = Math.round(gross * commissionPercent) / 100");
    expect(page).toContain("provider: Math.round((gross - platform) * 100) / 100");
    expect(page).toContain("const fee = Math.round(gross * DEFAULT_PERCENT) / 100");
    expect(page).toContain("[50, 100, 250, 500, 1000]");
  });

  it("keeps the economics display currency fixed to EUR", () => {
    const i18n = read("lib/klyx-founder-economics-i18n.ts");
    expect(i18n).toContain('currency: "EUR"');
  });
});

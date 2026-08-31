import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider finance visual contract", () => {
  it("keeps finance data and Stripe actions while using the KLYX visual language", () => {
    const finance = read("app/provider/payments/page.tsx");

    expect(finance).toContain("KLYX_PROVIDER_FINANCE_VISUAL_2026_08_31");
    expect(finance).toContain("KLYX_AI_FIRST_PROVIDER_FINANCE_15_04");
    expect(finance).toContain("Journal KLYX · paiements traités par Stripe.");

    expect(finance).toContain('fetch("/api/stripe/connect/status"');
    expect(finance).toContain('fetch("/api/provider/finance"');
    expect(finance).toContain('"/api/stripe/connect/create-account"');
    expect(finance).toContain("window.location.assign(result.url)");

    expect(finance).toContain("text-blue-600");
    expect(finance).toContain("bg-blue-600");
    expect(finance).not.toContain("violet-");
    expect(finance).not.toContain("indigo-");
    expect(finance).not.toContain("#2b1452");

    expect(finance).toContain("bg-emerald-500/10");
    expect(finance).toContain("bg-amber-500/10");
    expect(finance).toContain("bg-rose-500/10");
  });
});

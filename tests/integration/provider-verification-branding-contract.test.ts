import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const verificationPage = readFileSync(
  join(process.cwd(), "app/provider/verification/page.tsx"),
  "utf8"
);

describe("provider verification branding contract", () => {
  it("keeps the verification hero aligned with the KLYX visual system", () => {
    expect(verificationPage).toContain(
      '<section className="klyx-card p-7 sm:p-10">'
    );
    expect(verificationPage).toContain("#2563EB");
    expect(verificationPage).toContain("text-muted-foreground");

    expect(verificationPage).not.toContain("linear-gradient");
    expect(verificationPage).not.toContain("#111827");
    expect(verificationPage).not.toContain("#1e3157");
    expect(verificationPage).not.toContain("#0f172a");
    expect(verificationPage).not.toContain("border-white/10");
    expect(verificationPage).not.toContain("bg-white/5");
    expect(verificationPage).not.toContain("text-white/70");
  });

  it("uses the exact KLYX blue for normal verification accents", () => {
    expect(verificationPage).toContain("text-[#2563EB]");
    expect(verificationPage).toContain("bg-[#2563EB]/10");
    expect(verificationPage).toContain("bg-[#2563EB]");

    for (const legacyClass of [
      "text-blue-600",
      "text-blue-400",
      "bg-blue-500/10",
      "bg-blue-600",
    ]) {
      expect(verificationPage).not.toContain(legacyClass);
    }
  });

  it("preserves semantic states and provider verification boundaries", () => {
    expect(verificationPage).toContain("amber-500");
    expect(verificationPage).toContain("emerald-500");
    expect(verificationPage).toContain("rose-500");

    expect(verificationPage).toContain(
      "const profile = await getActiveProfileAccount();"
    );
    expect(verificationPage).toContain(
      'if (profile.accountType !== "provider")'
    );
    expect(verificationPage).toContain('"/api/provider/verification"');
    expect(verificationPage).toContain(
      '"/api/provider/verification/document"'
    );
    expect(verificationPage).toContain('.from("provider-verification")');
  });
});

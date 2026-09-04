import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const trustPage = readFileSync(
  join(process.cwd(), "app/provider/trust/page.tsx"),
  "utf8"
);

describe("provider trust branding contract", () => {
  it("uses the exact KLYX blue for trust-page accents", () => {
    expect(trustPage).toContain("text-[#2563EB]");
    expect(trustPage).toContain("border-[#2563EB]/20");
    expect(trustPage).toContain("bg-[#2563EB]/8");

    expect(trustPage).not.toContain("text-blue-600");
    expect(trustPage).not.toContain("text-blue-700");
    expect(trustPage).not.toContain("text-blue-500");
    expect(trustPage).not.toContain("text-blue-400");
    expect(trustPage).not.toContain("text-blue-300");
    expect(trustPage).not.toContain("border-blue-500/20");
    expect(trustPage).not.toContain("bg-blue-600/8");
  });

  it("preserves the provider profile boundary and grounded disputes API", () => {
    expect(trustPage).toContain(
      'import { getActiveProfileAccount } from "@/lib/account-switcher";'
    );
    expect(trustPage).toContain(
      "const profile = await getActiveProfileAccount();"
    );
    expect(trustPage).toContain(
      'if (profile.accountType !== "provider")'
    );
    expect(trustPage).toContain('fetch("/api/disputes"');
  });
});

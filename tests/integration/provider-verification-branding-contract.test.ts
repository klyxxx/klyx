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

  it("preserves the explicit provider role boundary", () => {
    expect(verificationPage).toContain(
      "const profile = await getActiveProfileAccount();"
    );
    expect(verificationPage).toContain(
      'if (profile.accountType !== "provider")'
    );
  });
});

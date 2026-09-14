import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const verificationPage = readFileSync(
  join(process.cwd(), "app/provider/verification/page.tsx"),
  "utf8"
);

describe("provider verification capability guard contract", () => {
  it("uses the offer-capable compatibility profile without requiring a provider role switch", () => {
    expect(verificationPage).toContain(
      'import { getActiveOfferProfile } from "@/lib/account-switcher";'
    );
    expect(verificationPage).toContain(
      "const profile = await getActiveOfferProfile();"
    );
    expect(verificationPage).not.toContain(
      'if (profile.accountType !== "provider")'
    );
    expect(verificationPage).toContain("setProfileId(profile.id)");
    expect(verificationPage).not.toContain("getActiveClientProfile");
  });
});

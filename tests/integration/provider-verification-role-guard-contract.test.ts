import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const verificationPage = readFileSync(
  join(process.cwd(), "app/provider/verification/page.tsx"),
  "utf8"
);

describe("provider verification role guard contract", () => {
  it("uses the active provider profile instead of the client-only helper", () => {
    expect(verificationPage).toContain(
      'import { getActiveProfileAccount } from "@/lib/account-switcher";'
    );
    expect(verificationPage).toContain(
      "const profile = await getActiveProfileAccount();"
    );
    expect(verificationPage).toContain(
      'if (profile.accountType !== "provider")'
    );
    expect(verificationPage).toContain("setProfileId(profile.id)");
    expect(verificationPage).not.toContain("getActiveClientProfile");
  });
});

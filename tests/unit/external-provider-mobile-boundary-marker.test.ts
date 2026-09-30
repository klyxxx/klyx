import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX mobile provider authority boundary", () => {
  it("delegates sensitive provider actions to KLYX Core", () => {
    const core = read("mobile/src/klyx-core.ts");
    const sumsub = read("mobile/src/sumsub.ts");

    expect(core).toContain('"/api/stripe/create-checkout-session"');
    expect(core).toContain('"/api/provider/sumsub/token"');
    expect(core).toContain('"/api/provider/sumsub/status"');
    expect(core).toContain('"/api/provider/finance"');
    expect(core).toContain('authority: "klyx_core"');
    expect(core).toContain("financialAuthorityOnClient: false");
    expect(core).toContain("eligibilityAuthorityOnClient: false");
    expect(core).toContain("ledgerAuthorityOnClient: false");

    expect(sumsub).toContain("createSumsubSdkToken");
    expect(sumsub).not.toContain("SUMSUB_APP_TOKEN");
    expect(sumsub).not.toContain("SUMSUB_SECRET_KEY");
  });
});

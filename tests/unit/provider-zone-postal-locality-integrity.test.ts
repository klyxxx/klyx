import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/api/provider/zones/zones-route-core.ts"),
  "utf8"
);

describe("provider zone postal/locality integrity", () => {
  it("rejects an explicit postal code that does not belong to the selected locality", () => {
    expect(source).toContain("localityInput &&");
    expect(source).toContain("postalInput &&");
    expect(source).toContain("!knownLocality.postalCodes.includes(postalInput)");
    expect(source).toContain("KLYX_POSTAL_LOCALITY_MISMATCH");
  });

  it("keeps the canonical locality and postal fallback behavior", () => {
    expect(source).toContain("locality: knownLocality.name");
    expect(source).toContain("knownLocality.postalCodes[0]");
    expect(source).toContain("user_service_id,country_code,locality,postal_code");
  });
});

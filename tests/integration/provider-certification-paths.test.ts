import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX provider certification business paths", () => {
  it("locks DEMANDER and GAGNER end-to-end chains", () => {
    expect(scope).toContain("assistant → matching → quote → booking → Stripe → mission → incident → refund → close");
    expect(scope).toContain("assistant → profile → Twilio → Sumsub → eligibility → opportunity → mission → Stripe settlement");
  });
});

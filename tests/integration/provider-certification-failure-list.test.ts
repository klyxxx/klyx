import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX provider certification failure list", () => {
  it("contains every requested failure scenario", () => {
    for (const failure of [
      "OpenAI unavailable",
      "Stripe unavailable",
      "Supabase unavailable",
      "Sumsub unavailable",
      "delayed webhook",
      "double click",
      "network cut",
      "worker crash",
      "mobile/web resume",
    ]) {
      expect(scope).toContain(failure);
    }
  });
});

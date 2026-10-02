import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX provider certification provider list", () => {
  it("contains every requested transverse provider", () => {
    for (const provider of [
      "Twilio",
      "Sumsub",
      "Tolgee",
      "Resend",
      "Supabase",
      "Cloudflare Turnstile",
      "elmah.io",
      "OpenAI/fallback",
    ]) {
      expect(scope).toContain(provider);
    }
  });
});

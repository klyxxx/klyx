import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const scope = fs.readFileSync(
  path.join(process.cwd(), "CERTIFICATION_ALL_PROVIDERS.md"),
  "utf8"
);

describe("KLYX all-provider certification report scope", () => {
  it("locks every requested provider and failure domain into the certification contract", () => {
    for (const term of [
      "DEMANDER",
      "GAGNER",
      "Twilio",
      "Sumsub",
      "Tolgee",
      "Resend",
      "Supabase",
      "Cloudflare",
      "elmah.io",
      "OpenAI/fallback",
      "OpenAI unavailable",
      "Stripe unavailable",
      "Supabase unavailable",
      "Sumsub unavailable",
      "delayed webhook",
      "double click",
      "network cut",
      "worker crash",
      "mobile/web resume",
      "human_review",
    ]) {
      expect(scope).toContain(term);
    }
  });
});

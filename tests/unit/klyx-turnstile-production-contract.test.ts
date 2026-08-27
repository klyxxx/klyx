import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const nextConfigSource = fs.readFileSync(
  path.join(process.cwd(), "next.config.ts"),
  "utf8"
);

const turnstileSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/AuthTurnstile.tsx"),
  "utf8"
);

describe("KLYX production Turnstile contract", () => {
  it("blocks a Vercel production deploy when the public Turnstile key is missing", () => {
    expect(nextConfigSource).toContain('process.env.VERCEL_ENV === "production"');
    expect(nextConfigSource).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(nextConfigSource).toContain("if (isVercelProduction && !turnstileSiteKey)");
    expect(nextConfigSource).toContain("production deploy blocked");
  });

  it("keeps the auth widget wired to the same public key", () => {
    expect(turnstileSource).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(turnstileSource).toContain("AUTH_TURNSTILE_ENABLED");
  });
});

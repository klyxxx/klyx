import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const workflow = read(".github/workflows/klyx-e2e.yml");
const helper = read("tests/e2e/helpers/authenticated-session.ts");
const multiprofile = read("tests/e2e/authenticated-multiprofile.spec.ts");
const boundaries = read("tests/e2e/authenticated-session-boundaries.spec.ts");

describe("KLYX E2E Turnstile session bootstrap contract", () => {
  it("is explicit, CI-only by configuration and requires the service-role secret", () => {
    expect(workflow).toContain('KLYX_E2E_SESSION_BOOTSTRAP: "1"');
    expect(workflow).toContain(
      "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
    );
    expect(helper).toContain(
      'process.env.KLYX_E2E_SESSION_BOOTSTRAP === "1"'
    );
    expect(helper).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
  });

  it("refuses accidental test-user creation before generating an admin magic link", () => {
    expect(helper).toContain("admin.auth.admin.listUsers");
    expect(helper).toContain(
      "Dedicated KLYX E2E user does not already exist; refusing admin magic-link bootstrap."
    );
    expect(helper).toContain("expectedUserId: existing.id");
    expect(helper).toContain("admin.auth.admin.generateLink");
    expect(helper).toContain('type: "magiclink"');
  });

  it("binds the verified session to the exact pre-existing E2E user identity", () => {
    expect(helper).toContain("const { admin, expectedUserId }");
    expect(helper).toContain("verified.user.id !== expectedUserId");
    expect(helper).toContain(
      "Dedicated E2E bootstrap resolved an unexpected user identity."
    );
  });

  it("exchanges only the one-time token through the public auth client and lets SSR emit cookies", () => {
    expect(helper).toContain("createServerClient");
    expect(helper).toContain("authClient.auth.verifyOtp");
    expect(helper).toContain("token_hash: tokenHash");
    expect(helper).toContain('type: "email"');
    expect(helper).toContain("cookiesToSet = nextCookies.map");
    expect(helper).toContain("page.context().addCookies");
  });

  it("does not reintroduce password sign-in as a CAPTCHA bypass", () => {
    expect(helper).not.toContain("signInWithPassword");
    expect(helper).not.toContain("KLYX_E2E_PASSWORD");
    expect(multiprofile).not.toContain("KLYX_E2E_PASSWORD");
    expect(boundaries).not.toContain("KLYX_E2E_PASSWORD");
    expect(workflow).not.toContain("KLYX_E2E_PASSWORD");
  });

  it("keeps authenticated browser artifacts off for session-bearing suites", () => {
    for (const source of [multiprofile, boundaries]) {
      expect(source).toContain('trace: "off"');
      expect(source).toContain('screenshot: "off"');
      expect(source).toContain('video: "off"');
    }

    expect(workflow).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(workflow).toContain("Sensitive E2E credential detected.");
  });
});

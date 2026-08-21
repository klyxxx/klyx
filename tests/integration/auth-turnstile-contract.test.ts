import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const turnstile = readRepoFile(
  "app/components/AuthTurnstile.tsx"
);
const login = readRepoFile("app/login/page.tsx");
const signup = readRepoFile("app/signup/page.tsx");
const runbook = readRepoFile(
  "docs/security/auth-abuse-protection.md"
);

describe("KLYX Supabase Auth bot protection wiring", () => {
  it("loads Cloudflare Turnstile only from the public site-key configuration", () => {
    expect(turnstile).toContain(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    );
    expect(turnstile).toContain(
      "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY"
    );
    expect(turnstile).toContain("AUTH_TURNSTILE_ENABLED");
    expect(turnstile).toContain("AUTH_TURNSTILE_SITE_KEY");
    expect(turnstile).not.toContain("TURNSTILE_SECRET_KEY");
    expect(turnstile).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("requires a fresh token before login when Turnstile is configured", () => {
    expect(login).toContain("AUTH_TURNSTILE_ENABLED &&");
    expect(login).toContain("!captchaToken");
    expect(login).toContain("Valide d’abord la vérification anti-robot.");
    expect(login).toContain("signInWithPassword({");
    expect(login).toContain("captchaToken,");
    expect(login).toContain('action="login"');
    expect(login).toContain("resetCaptcha();");
  });

  it("passes the same Supabase-supported captcha option to password reset", () => {
    expect(login).toContain("resetPasswordForEmail(");
    expect(login).toContain("captchaToken:");
    expect(login).toContain("AUTH_TURNSTILE_ENABLED");
    expect(login).toContain(
      "La vérification anti-robot a expiré ou a échoué. Réessaie."
    );
  });

  it("requires and forwards a fresh token for account creation", () => {
    expect(signup).toContain("AUTH_TURNSTILE_ENABLED &&");
    expect(signup).toContain("!captchaToken");
    expect(signup).toContain("supabase.auth.signUp({");
    expect(signup).toContain("captchaToken:");
    expect(signup).toContain('action="signup"');
    expect(signup).toContain("resetCaptcha();");
  });

  it("does not pretend code-only wiring enables server-side CAPTCHA verification", () => {
    expect(runbook).toContain(
      "Settings > Authentication > Bot and Abuse Protection"
    );
    expect(runbook).toContain("Cloudflare Turnstile");
    expect(runbook).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(runbook).toContain("Secret key");
    expect(runbook).toContain(
      "ne pas considérer la protection CAPTCHA comme active"
    );
  });
});

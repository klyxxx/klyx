import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX client route guard locale and brand contract", () => {
  it("uses localized visible copy without changing redirect destinations", () => {
    const guard = read("app/components/ClientRouteGuard.tsx");

    expect(guard).toContain('useKlyxLocale');
    expect(guard).toContain('translateKlyxClientRouteGuard');
    expect(guard).toContain('router.replace("/login")');
    expect(guard).toContain('router.replace("/provider/assistant")');
    expect(guard).toContain('t("verificationErrorTitle")');
    expect(guard).toContain('t("retry")');
    expect(guard).toContain('t("redirecting")');
    expect(guard).toContain('t("checking")');
  });

  it("keeps failures presentation-safe and localized", () => {
    const guard = read("app/components/ClientRouteGuard.tsx");

    expect(guard).toContain(
      'translateKlyxClientRouteGuard(locale, "profileCheckError")'
    );
    expect(guard).not.toContain('body.error');
    expect(guard).not.toContain('error.message');
    expect(guard).not.toContain('Vérification impossible');
    expect(guard).not.toContain('Réessayer');
    expect(guard).not.toContain('Redirection vers ton espace KLYX...');
    expect(guard).not.toContain('Vérification du profil actif...');
  });

  it("uses the KLYX blue accent instead of legacy violet", () => {
    const guard = read("app/components/ClientRouteGuard.tsx");

    expect(guard).toContain('text-blue-600');
    expect(guard).not.toContain('text-violet-600');
  });
});

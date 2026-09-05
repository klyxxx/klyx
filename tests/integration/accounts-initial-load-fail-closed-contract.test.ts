import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

const accountSwitcher = read("lib/account-switcher.ts");
const recoveryPage = read("app/accounts/load-error/page.tsx");

describe("KLYX accounts initial load fail-closed contract", () => {
  it("redirects the accounts surface away from profile actions when profile state cannot load", () => {
    expect(accountSwitcher).toContain(
      'if (window.location.pathname !== "/accounts") return;'
    );
    expect(accountSwitcher).toContain('"/accounts/load-error"');
    expect(accountSwitcher).toContain("failClosedAccountsLoad();");
  });

  it("preserves the authentication boundary for an expired session", () => {
    expect(accountSwitcher).toContain(
      'status === 401 ? "/login" : "/accounts/load-error"'
    );
    expect(accountSwitcher).toContain("responseHandled = true;");
    expect(accountSwitcher).toContain("failClosedAccountsLoad(response.status);");
    expect(accountSwitcher).toContain("if (!responseHandled)");
  });

  it("provides an explicit full-document retry without profile mutation controls", () => {
    expect(recoveryPage).toContain('href="/accounts"');
    expect(recoveryPage).toContain('href="/dashboard"');
    expect(recoveryPage).toContain('role="alert"');

    expect(recoveryPage).not.toContain("createProfile(");
    expect(recoveryPage).not.toContain("updateProfile(");
    expect(recoveryPage).not.toContain("deleteProfile(");
    expect(recoveryPage).not.toContain("switchAccount(");
  });
});

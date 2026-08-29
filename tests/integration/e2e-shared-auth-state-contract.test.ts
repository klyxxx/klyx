import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const config = read("playwright.config.ts");
const setup = read("tests/e2e/auth.setup.ts");
const helper = read("tests/e2e/helpers/authenticated-session.ts");
const multiProfile = read("tests/e2e/authenticated-multiprofile.spec.ts");
const gitignore = read(".gitignore");

describe("KLYX E2E shared authenticated state contract", () => {
  it("stores shared auth state only in ignored transient test results", () => {
    expect(config).toContain('"test-results"');
    expect(config).toContain('".auth"');
    expect(config).toContain("storageState: sharedAuthState");
    expect(setup).toContain("storageState({ path: KLYX_E2E_AUTH_STATE_PATH })");
    expect(gitignore).toContain("/test-results/");
  });

  it("uses a dedicated setup project only for read-heavy authenticated suites", () => {
    expect(config).toContain('name: "auth-setup"');
    expect(config).toContain('name: "chromium-authenticated"');
    expect(config).toContain('dependencies: ["auth-setup"]');
    expect(config).toContain("client-surfaces|provider-surfaces|session-boundaries");
    expect(config).toContain("testIgnore: sharedAuthSpecs");
  });

  it("verifies the shared JWT on a private KLYX API before saving it", () => {
    expect(setup).toContain("readKlyxE2EProfiles");
    expect(setup.indexOf("readKlyxE2EProfiles(page)")).toBeLessThan(
      setup.indexOf("storageState({ path: KLYX_E2E_AUTH_STATE_PATH })")
    );
  });

  it("does not call signInWithPassword again when stored auth already redirects to dashboard", () => {
    expect(helper).toContain("Promise.race");
    expect(helper).toContain('loginState === "authenticated"');
    expect(helper).toContain("return;");
  });

  it("keeps one explicit browser login in the multi-profile continuity test", () => {
    expect(multiProfile).toContain('"Votre mot de passe"');
    expect(multiProfile).toContain('"Se connecter"');
    expect(config).not.toContain("authenticated-multiprofile");
  });
});

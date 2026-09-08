import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLYX product analytics auth event contract", () => {
  const analytics = read("app/components/KlyxProductAnalytics.tsx");

  it("captures a successful sign-in independently of the current route", () => {
    expect(analytics).toContain('event !== "SIGNED_IN"');
    expect(analytics).toContain('captureKlyxProductEvent("account signed in")');
    expect(analytics).not.toContain('pathname === "/login"');
  });

  it("deduplicates sign-in capture for the current auth session and resets on sign-out", () => {
    expect(analytics).toContain("SIGNIN_CAPTURED_STORAGE_KEY");
    expect(analytics).toContain("wasSignInCapturedInSession");
    expect(analytics).toContain("markSignInCapturedInSession");
    expect(analytics).toContain('event === "SIGNED_OUT"');
    expect(analytics).toContain("clearSignInCapturedInSession");
  });

  it("keeps a fresh signup classified as signup rather than an extra sign-in", () => {
    expect(analytics).toContain("isFreshSignup");
    expect(analytics).toContain('captureKlyxProductEvent("account signed up")');
    expect(analytics).toContain("markSignInCapturedInSession();");
  });
});

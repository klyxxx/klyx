import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8"
  );
}

describe("external provider transport resilience", () => {
  it("bounds Sumsub calls through the shared recovery primitive without blind mutation replay", () => {
    const source = read("lib/sumsub.ts");

    expect(source).toContain("fetchWithProviderRecovery");
    expect(source).toContain('provider: "sumsub"');
    expect(source).toContain("timeoutMs: 8_000");
    expect(source).toContain(
      '(method === "GET" ? "safe" : "ambiguous")'
    );
    expect(source).toContain('replaySafety: "safe"');
  });

  it("fails closed for ambiguous Twilio OTP send and retries only replay-safe checks", () => {
    const source = read("lib/twilio-verify.ts");

    expect(source).toContain("fetchWithProviderRecovery");
    expect(source).toContain('operation: "start_verification"');
    expect(source).toContain('replaySafety: "ambiguous"');
    expect(source).toContain("maxAttempts: 1");
    expect(source).toContain('operation: "check_verification"');
    expect(source).toContain('replaySafety: "safe"');
    expect(source).toContain("maxAttempts: 3");
    expect(source.match(/timeoutMs: 8_000/g)?.length).toBe(2);
  });
});

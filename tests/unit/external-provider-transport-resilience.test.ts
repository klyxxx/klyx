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
  it("bounds Sumsub network calls without blind mutation retries", () => {
    const source = read("lib/sumsub.ts");

    expect(source).toContain("const SUMSUB_TIMEOUT_MS = 15_000");
    expect(source).toContain(
      "signal: AbortSignal.timeout(SUMSUB_TIMEOUT_MS)"
    );
    expect(source).toContain(
      "KLYX must fail closed and reconcile explicitly"
    );
  });

  it("bounds both Twilio Verify calls without blind OTP retries", () => {
    const source = read("lib/twilio-verify.ts");

    expect(source).toContain(
      "const TWILIO_VERIFY_TIMEOUT_MS = 15_000"
    );
    expect(
      source.match(
        /signal: AbortSignal\.timeout\(TWILIO_VERIFY_TIMEOUT_MS\)/g
      )?.length
    ).toBe(2);
    expect(source).toContain(
      "KLYX keeps verification fail-closed"
    );
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function mirroredCoreTokens(wrapper: string): string[] {
  return Array.from(wrapper.matchAll(/@core:(.+)$/gm), (match) =>
    match[1].trim()
  );
}

const routePairs = [
  [
    "app/api/stripe/create-checkout-session/route.ts",
    "app/api/stripe/create-checkout-session/route-core.ts",
  ],
  [
    "app/api/stripe/create-group-checkout-session/route.ts",
    "app/api/stripe/create-group-checkout-session/route-core.ts",
  ],
  [
    "app/api/bookings/split-missions/[id]/checkout/route.ts",
    "app/api/bookings/split-missions/[id]/checkout/route-core.ts",
  ],
] as const;

describe("payment route/core static contract bridge", () => {
  for (const [wrapperPath, corePath] of routePairs) {
    it(`${wrapperPath} mirrors only invariants that exist in its core`, () => {
      const wrapper = source(wrapperPath);
      const core = source(corePath);
      const tokens = mirroredCoreTokens(wrapper);

      expect(wrapper).toContain("KLYX_PAYMENT_CORE_CONTRACT_MIRROR");
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(
          core.includes(token),
          `${wrapperPath} mirrors a token absent from ${corePath}: ${token}`
        ).toBe(true);
      }
    });
  }
});
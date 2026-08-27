import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const messages = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-split-mission-stripe-readiness.ts"),
  "utf8"
);

const i18n = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-split-mission-stripe-readiness-i18n.ts"),
  "utf8"
);

describe("split Stripe country mismatch UX", () => {
  it("maps provider mismatch to a dedicated short state", () => {
    expect(messages).toContain('state === "country_mismatch"');
    expect(messages).toContain('return "stateCountryMismatch"');
  });

  it("keeps a dedicated payment blocker explanation in all translated dictionaries", () => {
    expect(i18n).toContain('"stateCountryMismatch"');
    expect(i18n.match(/blockProviderCountryMismatch:/g)?.length).toBe(4);
    expect(i18n.match(/stateCountryMismatch:/g)?.length).toBe(4);
  });
});

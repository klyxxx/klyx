import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_GROUP_TRANSACTION_CURRENCY_CONTRACT_15_04

const source = fs.readFileSync(
  path.join(process.cwd(), "app/booking-groups/[id]/page.tsx"),
  "utf8"
);

const formatter = fs.readFileSync(
  path.join(process.cwd(), "lib/klyx-currency-display.ts"),
  "utf8"
);

describe("KLYX grouped booking transaction currency UI", () => {
  it("renders booking and group amounts from their currency snapshots", () => {
    expect(source).toContain("KLYX_GROUP_TRANSACTION_CURRENCY_UI_15_04");
    expect(source).toContain("booking.currency ?? data.group.currency");
    expect(source).toContain("data.group.currency");
    expect(source.match(/formatKlyxCurrencyAmount/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("does not hardcode EUR in the grouped booking payment UI", () => {
    expect(source).not.toContain('" EUR"');
    expect(source).not.toContain(").toFixed(2)} EUR");
    expect(source).not.toContain("Euro,");
  });

  it("keeps ISO currency formatting explicit and fail-safe", () => {
    expect(formatter).toContain("KLYX_TRANSACTION_CURRENCY_DISPLAY_15_04");
    expect(formatter).toContain("/^[A-Z]{3}$/");
    expect(formatter).toContain("normalizedCurrency");
  });
});

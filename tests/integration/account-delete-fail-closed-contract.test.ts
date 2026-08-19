import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account deletion fail-closed contract", () => {
  it("blocks deletion when active-booking or payment-safety queries fail", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/account/delete/route.ts"),
      "utf8"
    );

    expect(source).toContain("error: clientBookingsError");
    expect(source).toContain("error: providerBookingsError");
    expect(source).toContain("if (clientBookingsError) throw clientBookingsError");
    expect(source).toContain("if (providerBookingsError) throw providerBookingsError");

    expect(source).toContain("error: paidClientError");
    expect(source).toContain("error: paidProviderError");
    expect(source).toContain("if (paidClientError) throw paidClientError");
    expect(source).toContain("if (paidProviderError) throw paidProviderError");

    expect(source.indexOf("if (clientBookingsError) throw clientBookingsError")).toBeLessThan(
      source.indexOf("(clientBookings?.length ?? 0) > 0")
    );
    expect(source.indexOf("if (paidClientError) throw paidClientError")).toBeLessThan(
      source.indexOf("(paidClient?.length ?? 0) > 0")
    );

    expect(source).toContain("KLYX_ACCOUNT_DELETE_FAILED");
    expect(source).toContain("KLYX_ACCOUNT_DELETE_STRIPE_BLOCKED");
  });
});

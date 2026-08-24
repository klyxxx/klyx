import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Founder transaction-test i18n contract", () => {
  it("preserves GET-only no-store readiness loading", () => {
    const page = read("app/founder/transaction-test/page.tsx");
    const route = read("app/api/founder/transaction-readiness/route.ts");
    expect(page).toContain('fetch("/api/founder/transaction-readiness", {');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("onClick={() => void load()}");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain("setTimeout(");
    expect(page).not.toContain("setInterval(");
    expect(route).toContain("export async function GET()");
  });

  it("keeps server-authored diagnostic evidence verbatim", () => {
    const page = read("app/founder/transaction-test/page.tsx");
    expect(page).toContain("{check.label}");
    expect(page).toContain("{check.detail}");
    expect(page).toContain("{step}");
    expect(page).toContain("data.checks.map");
    expect(page).toContain("data.flow.map");
  });

  it("localizes chrome and does not reflect backend errors", () => {
    const page = read("app/founder/transaction-test/page.tsx");
    expect(page).toContain("KLYX_FOUNDER_TRANSACTION_TEST_I18N");
    expect(page).toContain("useKlyxLocale");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
  });

  it("does not introduce a payment execution surface", () => {
    const page = read("app/founder/transaction-test/page.tsx");
    expect(page).not.toContain("PaymentIntent");
    expect(page).not.toContain("CheckoutSession");
    expect(page).not.toContain("refund");
    expect(page).not.toContain("transfer");
  });
});

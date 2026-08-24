import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX admin finance read-only contract", () => {
  it("repairs the admin finance destination with a localized page", () => {
    const page = read("app/admin/finance/page.tsx");
    expect(page).toContain("KLYX_ADMIN_FINANCE_READ_ONLY");
    expect(page).toContain("useKlyxLocale");
    expect(page).toContain('href="/admin"');
  });

  it("uses only the two existing authenticated no-store admin diagnostics", () => {
    const page = read("app/admin/finance/page.tsx");
    expect(page).toContain('"/api/admin/stripe-readiness"');
    expect(page).toContain('"/api/admin/stripe-webhook-health"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
    expect(page).not.toContain('"/api/stripe/create-checkout-session"');
    expect(page).not.toContain('"/api/stripe/create-group-checkout-session"');
  });

  it("does not expose raw Stripe details, Connect ids, or backend messages", () => {
    const page = read("app/admin/finance/page.tsx");
    expect(page).not.toContain("check.detail");
    expect(page).not.toContain("accountId");
    expect(page).not.toContain("profileId");
    expect(page).not.toContain("body.error");
    expect(page).not.toContain("error.message");
    expect(page).not.toContain("instanceof Error");
  });

  it("keeps both diagnostic APIs GET-only", () => {
    const readiness = read("app/api/admin/stripe-readiness/route.ts");
    const webhook = read("app/api/admin/stripe-webhook-health/route.ts");
    expect(readiness).toContain("export async function GET()");
    expect(webhook).toContain("export async function GET()");
    expect(readiness).not.toContain("export async function POST");
    expect(webhook).not.toContain("export async function POST");
  });

  it("has no automatic retry or financial mutation trigger", () => {
    const page = read("app/admin/finance/page.tsx");
    expect(page).toContain("onClick={() => void load()}");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
    expect(page).not.toContain("stripe.refunds.create");
    expect(page).not.toContain("stripe.paymentIntents.create");
    expect(page).not.toContain("stripe.transfers.create");
  });
});

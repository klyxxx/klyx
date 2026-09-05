import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

const checkoutRoute = "app/api/stripe/create-checkout-session/route.ts";
const groupCheckoutRoute = "app/api/stripe/create-group-checkout-session/route.ts";

function assertOrphanCheckoutExpirationContract(source: string) {
  expect(source).toContain("async function expireUnpersistedCheckoutSession(");
  expect(source).toContain('if (session.status !== "open") return;');
  expect(source).toContain("await stripe.checkout.sessions.expire(session.id);");

  const persistenceGuard = source.match(
    /try \{[\s\S]*?payment_attempt_token[\s\S]*?\} catch \(error\) \{[\s\S]*?await expireUnpersistedCheckoutSession\(stripe, session\);[\s\S]*?throw error;[\s\S]*?\}/
  );
  expect(persistenceGuard).not.toBeNull();
}

describe("KLY-8 orphan Checkout session expiration contract", () => {
  it("expires an unpersisted simple-booking Checkout session before propagating persistence failure", () => {
    const source = read(checkoutRoute);
    assertOrphanCheckoutExpirationContract(source);
    expect(source).toContain("await expireUnpersistedCheckoutSession(stripe, session);");
    expect(source).toContain("alreadyPaid: true");
  });

  it("expires an unpersisted grouped-booking Checkout session before propagating persistence failure", () => {
    const source = read(groupCheckoutRoute);
    assertOrphanCheckoutExpirationContract(source);
    expect(source).toContain("await expireUnpersistedCheckoutSession(stripe, session);");
    expect(source).toContain("alreadyPaid: true");
  });

  it("preserves the existing Stripe idempotency boundaries", () => {
    const simple = read(checkoutRoute);
    const grouped = read(groupCheckoutRoute);

    expect(simple).toContain("idempotencyKey");
    expect(grouped).toContain("idempotencyKey");
  });
});

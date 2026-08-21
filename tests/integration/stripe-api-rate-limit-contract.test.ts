import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const helper = readRepoFile("lib/api-rate-limit.ts");
const middleware = readRepoFile("lib/supabase/middleware.ts");
const proxy = readRepoFile("proxy.ts");

describe("KLYX Stripe API rate limits", () => {
  it("defines conservative authenticated Stripe policies", () => {
    expect(helper).toContain("stripeCheckoutCreate");
    expect(helper).toContain('action: "stripe_checkout_create"');
    expect(helper).toContain("stripeGroupCheckoutCreate");
    expect(helper).toContain('action: "stripe_group_checkout_create"');
    expect(helper).toContain("stripeConnectOnboarding");
    expect(helper).toContain('action: "stripe_connect_onboarding"');
    expect(helper).toContain("stripeConnectStatus");
    expect(helper).toContain('action: "stripe_connect_status"');
  });

  it("enforces quotas before the four Stripe network entry points", () => {
    expect(middleware).toContain(
      'pathname === "/api/stripe/create-checkout-session"'
    );
    expect(middleware).toContain(
      'pathname === "/api/stripe/create-group-checkout-session"'
    );
    expect(middleware).toContain(
      'pathname === "/api/stripe/connect/create-account"'
    );
    expect(middleware).toContain(
      'pathname === "/api/stripe/connect/status"'
    );
    expect(middleware).toContain("consumeApiRateLimit(user.id, policy)");
    expect(middleware).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
  });

  it("does not throttle the signed Stripe webhook through this user quota", () => {
    expect(middleware).not.toContain('pathname === "/api/stripe/webhook"');
  });

  it("fails closed without leaking rate-limit backend errors", () => {
    expect(middleware).toContain('code: "KLYX_RATE_LIMIT_UNAVAILABLE"');
    expect(middleware).toContain("status: 503");
    expect(middleware).toContain('"Retry-After": "5"');
    expect(middleware).not.toContain("error.message");
  });

  it("preserves refreshed auth cookies on blocked or unavailable responses", () => {
    expect(middleware).toContain("function copyResponseCookies");
    expect(middleware).toContain("source.cookies.getAll()");
    expect(middleware).toContain("target.cookies.set(cookie)");
  });

  it("keeps all non-static requests flowing through the auth proxy", () => {
    expect(proxy).toContain('import { updateSession } from "@/lib/supabase/middleware"');
    expect(proxy).toContain("return updateSession(request)");
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isKlyxProductAnalyticsEvent,
  KLYX_PRODUCT_ANALYTICS_EVENTS,
} from "@/lib/klyx-product-analytics-events";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KLY-5 privacy-first product analytics contract", () => {
  it("keeps the complete anonymous product journey allowlist", () => {
    expect(KLYX_PRODUCT_ANALYTICS_EVENTS).toEqual([
      "visit started",
      "account signed up",
      "account signed in",
      "profile created",
      "profile selected",
      "service searched",
      "provider opened",
      "booking started",
      "booking confirmed",
      "booking abandoned",
      "payment confirmed",
    ]);

    for (const event of KLYX_PRODUCT_ANALYTICS_EVENTS) {
      expect(isKlyxProductAnalyticsEvent(event)).toBe(true);
    }
    expect(isKlyxProductAnalyticsEvent("payment completed")).toBe(false);
  });

  it("uses a server-only allowlisted PostHog capture boundary", () => {
    const route = read("app/api/analytics/product/route.ts");

    expect(route).toContain("process.env.POSTHOG_PROJECT_TOKEN");
    expect(route).toContain("process.env.POSTHOG_HOST");
    expect(route).toContain("https://eu.i.posthog.com");
    expect(route).toContain("https://us.i.posthog.com");
    expect(route).toContain("/i/v0/e/");
    expect(route).toContain("$process_person_profile: false");
    expect(route).toContain("$geoip_disable: true");
    expect(route).toContain("keys.length !== 2");
    expect(route).toContain('keys.includes("event")');
    expect(route).toContain('keys.includes("sessionId")');

    expect(route).not.toContain("x-forwarded-for");
    expect(route).not.toContain("user-agent");
    expect(route).not.toContain("cookie(");
    expect(route).not.toMatch(/phc_[A-Za-z0-9_-]{12,}/);
  });

  it("keeps the browser payload anonymous and session-scoped", () => {
    const client = read("lib/klyx-product-analytics-client.ts");

    expect(client).toContain("sessionStorage");
    expect(client).toContain("crypto.randomUUID");
    expect(client).toContain("JSON.stringify({ event, sessionId })");
    expect(client).toContain('fetch("/api/analytics/product"');
    expect(client).toContain("keepalive: true");
    expect(client).not.toContain("localStorage");

    for (const forbidden of [
      "email",
      "full_name",
      "providerId",
      "bookingId",
      "searchQuery",
      "paymentIntent",
      "amount",
      "message",
    ]) {
      expect(client).not.toContain(forbidden);
    }
  });

  it("wires acquisition, auth, search and booking without route ids or search text", () => {
    const observer = read("app/components/KlyxProductAnalytics.tsx");

    for (const event of [
      "visit started",
      "account signed up",
      "account signed in",
      "service searched",
      "provider opened",
      "booking started",
      "booking confirmed",
      "booking abandoned",
    ]) {
      expect(observer).toContain(`captureKlyxProductEvent("${event}")`);
    }

    expect(observer).toContain("VISIT_STARTED_STORAGE_KEY");
    expect(observer).toContain("SIGNUP_CAPTURED_STORAGE_KEY");
    expect(observer).toContain("sessionStorage");
    expect(observer).toContain("onAuthStateChange");
    expect(observer).toContain('event !== "SIGNED_IN"');
    expect(observer).toContain("email_confirmed_at");
    expect(observer).toContain("confirmationMatchesSignIn");
    expect(observer).toContain('pathname === "/recommendations"');
    expect(observer).toContain("PROVIDER_PATH");
    expect(observer).toContain("BOOKING_FORM_PATH");
    expect(observer).toContain("BOOKING_DETAIL_PATH");
    expect(observer).toContain('searchParams.get("created") === "1"');
    expect(observer).toContain("isFreshlyCreatedAuthUser");
    expect(observer).not.toContain('previousPath === "/login"');
    expect(observer).not.toContain('previousPath === "/signup"');
    expect(observer).not.toContain("providerId:");
    expect(observer).not.toContain("bookingId:");
    expect(observer).not.toContain("query:");
  });

  it("captures profile milestones only after successful profile operations", () => {
    const accounts = read("lib/account-switcher.ts");
    const onboarding = read("app/onboarding/page.tsx");
    const firstProfileAnalytics = read(
      "app/onboarding/KlyxFirstProfileAnalytics.tsx"
    );

    expect(accounts).toContain(
      'captureKlyxProductEvent("profile selected")'
    );
    expect(accounts).toContain(
      'captureKlyxProductEvent("profile created")'
    );
    expect(accounts).toContain("if (!response.ok)");
    expect(accounts).toContain("if (!result.profileId)");
    expect(accounts).not.toContain('captureKlyxProductEvent("profile deleted")');

    expect(onboarding).toContain(
      '<KlyxFirstProfileAnalytics phase="pending" />'
    );
    expect(onboarding).toContain(
      '<KlyxFirstProfileAnalytics phase="completed" />'
    );
    expect(firstProfileAnalytics).toContain("FIRST_PROFILE_PENDING_KEY");
    expect(firstProfileAnalytics).toContain("FIRST_PROFILE_CAPTURED_KEY");
    expect(firstProfileAnalytics).toContain("sessionStorage");
    expect(firstProfileAnalytics).toContain(
      'captureKlyxProductEvent("profile created")'
    );
    expect(firstProfileAnalytics).not.toContain("profileId");
  });

  it("captures payment only after the server confirms Stripe paid state", () => {
    const page = read("app/payment/success/page.tsx");
    const analytics = read(
      "app/payment/success/KlyxPaymentSuccessAnalytics.tsx"
    );

    expect(page).toContain('session.payment_status === "paid"');
    expect(page).toContain("await markBookingPaidFromSession(session)");
    expect(page).toContain(
      "confirmation.confirmed ? <KlyxPaymentSuccessAnalytics /> : null"
    );
    expect(analytics).toContain(
      'captureKlyxProductEvent("payment confirmed")'
    );
    expect(analytics).not.toContain("bookingId");
    expect(analytics).not.toContain("sessionId");
    expect(analytics).not.toContain("amount");
  });

  it("mounts analytics once at the root behind Suspense", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain('import { Suspense } from "react";');
    expect(layout).toContain("KlyxProductAnalytics");
    expect(layout).toContain("<Suspense fallback={null}>");
    expect(layout).toContain("<KlyxProductAnalytics />");
  });
});

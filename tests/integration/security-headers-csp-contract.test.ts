import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const nextConfig = read("next.config.ts");
const securityHeaders = read("lib/security-headers.ts");
const turnstile = read("app/components/AuthTurnstile.tsx");
const sumsubServer = read("lib/sumsub.ts");
const sumsubPage = read("app/provider/verification/sumsub/page.tsx");
const bookingDetail = read("app/bookings/[id]/page.tsx");
const connectPage = read("app/connect/page.tsx");
const analyticsClient = read("lib/klyx-product-analytics-client.ts");
const analyticsRoute = read("app/api/analytics/product/route.ts");

describe("KLYX CSP integration contract", () => {
  it("applies the security headers globally from Next.js without client secrets", () => {
    expect(nextConfig).toContain("buildKlyxSecurityHeaders");
    expect(nextConfig).toContain('source: "/(.*)"');
    expect(nextConfig).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(nextConfig).toContain('process.env.VERCEL_ENV === "production"');

    expect(securityHeaders).toContain('key: "Content-Security-Policy"');
    expect(securityHeaders).toContain('key: "X-Content-Type-Options"');
    expect(securityHeaders).toContain('value: "nosniff"');
    expect(securityHeaders).toContain('key: "Referrer-Policy"');
    expect(securityHeaders).toContain('key: "Permissions-Policy"');
    expect(securityHeaders).toContain('key: "Strict-Transport-Security"');
    expect(securityHeaders).not.toMatch(
      /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUMSUB_SECRET_KEY|POSTHOG_PROJECT_TOKEN|TOLGEE_API_KEY/
    );
  });

  it("allows the exact Turnstile script/frame origin used by login and signup", () => {
    expect(turnstile).toContain(
      '"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"'
    );
    expect(securityHeaders).toContain(
      '"https://challenges.cloudflare.com"'
    );
    expect(securityHeaders).toContain("script-src");
    expect(securityHeaders).toContain("frame-src");
    expect(securityHeaders).toContain("connect-src");
  });

  it("allows only the active Sumsub WebSDK origin and preserves camera/microphone delegation", () => {
    expect(sumsubServer).toContain(
      'const BASE_URL = "https://api.sumsub.com";'
    );
    expect(sumsubPage).toContain('from "@sumsub/websdk-react"');
    expect(securityHeaders).toContain(
      'KLYX_SUMSUB_ORIGIN = "https://api.sumsub.com"'
    );
    expect(securityHeaders).toContain(
      'camera=(self \\"${KLYX_SUMSUB_ORIGIN}\\")'
    );
    expect(securityHeaders).toContain(
      'microphone=(self \\"${KLYX_SUMSUB_ORIGIN}\\")'
    );
    expect(securityHeaders).not.toContain("*.sumsub.com");
    expect(securityHeaders).not.toContain("static.sumsub.com");
  });

  it("keeps Stripe as a hosted redirect instead of opening Stripe browser origins in CSP", () => {
    expect(bookingDetail).toContain("window.location.href = result.url");
    expect(connectPage).toContain("window.location.href = result.url");
    expect(securityHeaders).not.toContain("stripe.com");
    expect(securityHeaders).not.toContain("js.stripe.com");
  });

  it("keeps PostHog behind the same-origin product analytics API", () => {
    expect(analyticsClient).toContain('fetch("/api/analytics/product"');
    expect(analyticsRoute).toContain('"https://eu.i.posthog.com"');
    expect(analyticsRoute).toContain('"https://us.i.posthog.com"');
    expect(securityHeaders).not.toContain("posthog.com");
  });
});

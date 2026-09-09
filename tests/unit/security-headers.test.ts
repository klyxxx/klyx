import { describe, expect, it } from "vitest";

import {
  KLYX_SUMSUB_ORIGIN,
  KLYX_TURNSTILE_ORIGIN,
  buildKlyxContentSecurityPolicy,
  buildKlyxSecurityHeaders,
} from "@/lib/security-headers";

function headerMap(
  production: boolean,
  supabaseUrl: string | null | undefined
) {
  return new Map(
    buildKlyxSecurityHeaders({ production, supabaseUrl }).map(
      ({ key, value }) => [key, value]
    )
  );
}

describe("KLYX HTTP security headers", () => {
  it("builds a strict production CSP from only the browser origins KLYX needs", () => {
    const csp = buildKlyxContentSecurityPolicy({
      production: true,
      supabaseUrl: "https://project-ref.supabase.co/path/ignored",
    });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      `script-src 'self' 'unsafe-inline' ${KLYX_TURNSTILE_ORIGIN}`
    );
    expect(csp).toContain(
      `connect-src 'self' ${KLYX_TURNSTILE_ORIGIN} ${KLYX_SUMSUB_ORIGIN} https://project-ref.supabase.co wss://project-ref.supabase.co`
    );
    expect(csp).toContain(
      `frame-src ${KLYX_TURNSTILE_ORIGIN} ${KLYX_SUMSUB_ORIGIN}`
    );
    expect(csp).toContain(
      "img-src 'self' data: blob: https://project-ref.supabase.co"
    );
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("*.supabase.co");
    expect(csp).not.toContain("*.sumsub.com");
    expect(csp).not.toContain("*.stripe.com");
    expect(csp).not.toContain("stripe.com");
    expect(csp).not.toContain("posthog.com");
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
  });

  it("keeps local Next.js development compatible without weakening production", () => {
    const csp = buildKlyxContentSecurityPolicy({
      production: false,
      supabaseUrl: "http://127.0.0.1:54321",
    });

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://127.0.0.1:54321");
    expect(csp).toContain("ws://127.0.0.1:54321");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("sets exact baseline protections and production-only HSTS", () => {
    const productionHeaders = headerMap(
      true,
      "https://project-ref.supabase.co"
    );
    const developmentHeaders = headerMap(false, null);

    expect(productionHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(productionHeaders.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(productionHeaders.get("X-Frame-Options")).toBe("DENY");
    expect(productionHeaders.get("Strict-Transport-Security")).toBe(
      "max-age=31536000"
    );
    expect(developmentHeaders.has("Strict-Transport-Security")).toBe(false);

    expect(productionHeaders.get("Permissions-Policy")).toBe(
      `camera=(self \"${KLYX_SUMSUB_ORIGIN}\"), ` +
        `microphone=(self \"${KLYX_SUMSUB_ORIGIN}\"), ` +
        "geolocation=(), payment=(), usb=()"
    );
  });

  it("does not leak configuration secrets or accept non-HTTP Supabase origins", () => {
    const headers = buildKlyxSecurityHeaders({
      production: true,
      supabaseUrl: "javascript:alert(1)",
    });
    const serialized = JSON.stringify(headers);
    const csp = new Map(headers.map(({ key, value }) => [key, value])).get(
      "Content-Security-Policy"
    );

    expect(serialized).not.toMatch(
      /STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUMSUB_SECRET_KEY|POSTHOG_PROJECT_TOKEN|TOLGEE_API_KEY/
    );
    expect(csp).not.toContain("javascript:");
  });
});

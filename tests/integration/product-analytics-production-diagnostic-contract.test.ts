import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const route = fs.readFileSync(
  path.join(process.cwd(), "app/api/analytics/product/route.ts"),
  "utf8"
);

describe("KLY-9 PostHog production diagnostic contract", () => {
  it("keeps the configuration diagnostic admin-only and non-cacheable", () => {
    const getStart = route.indexOf("export async function GET()");
    const postStart = route.indexOf("export async function POST(request: Request)");
    const getBlock = route.slice(getStart, postStart);

    expect(getStart).toBeGreaterThanOrEqual(0);
    expect(postStart).toBeGreaterThan(getStart);
    expect(getBlock).toContain("await requireKlyxAdmin()");
    expect(getBlock).toContain("validatePostHogRuntime(");
    expect(getBlock).toContain("...runtime.diagnostic");
    expect(getBlock).toContain("...validation");
    expect(getBlock).toContain('"Cache-Control": "no-store"');
    expect(getBlock).toContain("adminErrorStatus(error)");
    expect(getBlock).toContain("adminErrorPublicMessage(status)");
    expect(getBlock).not.toContain("process.env.POSTHOG_PROJECT_TOKEN");
    expect(getBlock).not.toContain("process.env.POSTHOG_HOST");
  });

  it("exposes only safe configuration state and never secret values", () => {
    expect(route).toContain("const tokenConfigured = Boolean(projectToken)");
    expect(route).toContain("const hostConfigured = Boolean(rawHost)");
    expect(route).toContain("const hostAllowed = Boolean(origin)");
    expect(route).toContain("configured: tokenConfigured && hostAllowed");
    expect(route).toContain("tokenConfigured,");
    expect(route).toContain("hostConfigured,");
    expect(route).toContain("hostAllowed,");

    const diagnosticStart = route.indexOf("diagnostic: {");
    const diagnosticEnd = route.indexOf("},\n  };", diagnosticStart);
    const diagnosticBlock = route.slice(diagnosticStart, diagnosticEnd);

    expect(diagnosticStart).toBeGreaterThanOrEqual(0);
    expect(diagnosticBlock).not.toContain("projectToken");
    expect(diagnosticBlock).not.toContain("rawProjectToken");
    expect(diagnosticBlock).not.toContain("rawHost");
    expect(diagnosticBlock).not.toContain("origin,");
  });

  it("validates the project token without ingesting a synthetic product event", () => {
    expect(route).toContain('fetch(`${origin}/flags?v=2`');
    expect(route).toContain("api_key: projectToken");
    expect(route).toContain(
      'distinct_id: "klyx-posthog-config-diagnostic"'
    );
    expect(route).toContain('validationState: "valid"');
    expect(route).toContain('validationState: "invalid_token"');
    expect(route).toContain('validationState: "upstream_error"');
    expect(route).toContain('validationState: "unreachable"');
    expect(route).toContain("validationHttpStatus: response.status");

    const validationStart = route.indexOf("async function validatePostHogRuntime(");
    const getStart = route.indexOf("export async function GET()");
    const validationBlock = route.slice(validationStart, getStart);

    expect(validationStart).toBeGreaterThanOrEqual(0);
    expect(validationBlock).not.toContain("/i/v0/e/");
    expect(validationBlock).not.toContain("visit started");
    expect(validationBlock).not.toContain("account signed up");
  });

  it("logs only safe upstream capture status while preserving fail-open 204", () => {
    expect(route).toContain('fetch(`${origin}/i/v0/e/`');
    expect(route).toContain("if (!response.ok)");
    expect(route).toContain("logServerWarning({");
    expect(route).toContain('event: "posthog_product_capture_rejected"');
    expect(route).toContain("status: response.status");
    expect(route).toContain("logServerError({");
    expect(route).toContain('event: "posthog_product_capture_failed"');
    expect(route).toContain('code: "posthog_capture_failed"');
    expect(route).toContain("return noContent();");
  });

  it("preserves the privacy-first capture path and fail-open user journey", () => {
    expect(route).toContain('process.env.POSTHOG_PROJECT_TOKEN?.trim()');
    expect(route).toContain('process.env.POSTHOG_HOST?.trim()');
    expect(route).toContain("https://eu.i.posthog.com");
    expect(route).toContain("https://us.i.posthog.com");
    expect(route).toContain('fetch(`${origin}/i/v0/e/`');
    expect(route).toContain("$process_person_profile: false");
    expect(route).toContain("$geoip_disable: true");
    expect(route).toContain("return noContent();");

    for (const forbidden of [
      "email:",
      "userId:",
      "profileId:",
      "providerId:",
      "bookingId:",
      "amount:",
      "paymentIntent:",
      "searchQuery:",
      "message:",
    ]) {
      expect(route).not.toContain(forbidden);
    }
  });
});

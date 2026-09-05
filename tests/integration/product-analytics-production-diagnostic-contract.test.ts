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
    expect(getBlock).toContain("NextResponse.json(runtime.diagnostic");
    expect(getBlock).toContain('"Cache-Control": "no-store"');
    expect(getBlock).toContain("adminErrorStatus(error)");
    expect(getBlock).toContain("adminErrorPublicMessage(status)");
    expect(getBlock).not.toContain("process.env.POSTHOG_PROJECT_TOKEN");
    expect(getBlock).not.toContain("process.env.POSTHOG_HOST");
  });

  it("exposes only safe configuration booleans and never secret values", () => {
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

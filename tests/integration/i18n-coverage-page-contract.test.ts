import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX coverage i18n contract", () => {
  it("keeps coverage strictly read-only", () => {
    const page = read("app/coverage/page.tsx");

    expect(page).toContain("KLYX_COVERAGE_I18N");
    expect(page).toContain("KLYX_COVERAGE_READ_ONLY");
    expect(page).toContain('fetch("/api/search/coverage"');
    expect(page).toContain('fetch(`/api/search/coverage?${params.toString()}`');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("service: serviceSlug");
    expect(page).toContain("locality,");
    expect(page).not.toContain('method: "POST"');
    expect(page).not.toContain('method: "PATCH"');
    expect(page).not.toContain('method: "DELETE"');
  });

  it("preserves server-authored evidence verbatim", () => {
    const page = read("app/coverage/page.tsx");

    expect(page).toContain("provider.displayName");
    expect(page).toContain("provider.serviceName");
    expect(page).toContain("provider.coverageMessage");
    expect(page).toContain("privacyNotice");
    expect(page).toContain("service.name ?? service.slug");
    expect(page).toContain("item.name");
    expect(page).toContain("item.postalCodes.join");
  });

  it("preserves search navigation semantics", () => {
    const page = read("app/coverage/page.tsx");

    expect(page).toContain("service: provider.serviceSlug");
    expect(page).toContain("city: locality");
    expect(page).toContain("return `/search?${params.toString()}`");
    expect(page).toContain("encodeURIComponent(serviceSlug)");
    expect(page).toContain("encodeURIComponent(locality)");
  });

  it("does not reflect raw authentication or API errors", () => {
    const page = read("app/coverage/page.tsx");

    expect(page).not.toContain("body.error ||");
    expect(page).not.toContain("error instanceof Error");
    expect(page).not.toContain("error.message");
  });
});

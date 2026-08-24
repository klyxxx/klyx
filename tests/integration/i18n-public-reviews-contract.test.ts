import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX public reviews i18n contract", () => {
  it("keeps reviews strictly read-only", () => {
    const component = read("app/providers/[id]/PublicReviews.tsx");

    expect(component).toContain("KLYX_PUBLIC_REVIEWS_I18N");
    expect(component).toContain("KLYX_PUBLIC_REVIEWS_READ_ONLY");
    expect(component).toContain("`/api/providers/${providerId}/reviews`");
    expect(component).toContain('method: "GET"');
    expect(component).toContain('cache: "no-store"');
    expect(component).not.toContain('method: "POST"');
    expect(component).not.toContain('method: "PATCH"');
    expect(component).not.toContain('method: "DELETE"');
  });

  it("does not refetch reviews when only locale changes", () => {
    const component = read("app/providers/[id]/PublicReviews.tsx");

    expect(component).toContain("}, [providerId]);");
    expect(component).not.toContain("[providerId, locale]");
  });

  it("preserves review-authored evidence verbatim", () => {
    const component = read("app/providers/[id]/PublicReviews.tsx");

    expect(component).toContain("review.authorName");
    expect(component).toContain("review.authorAvatarUrl");
    expect(component).toContain("review.comment");
    expect(component).toContain("review.rating");
    expect(component).toContain("review.createdAt");
  });

  it("does not reflect raw API or network errors", () => {
    const component = read("app/providers/[id]/PublicReviews.tsx");

    expect(component).not.toContain("body.error ||");
    expect(component).not.toContain("error instanceof Error");
    expect(component).not.toContain("error.message");
  });
});

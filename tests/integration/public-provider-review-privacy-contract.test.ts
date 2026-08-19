import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public provider review privacy contract", () => {
  it("keeps verified reviews public without exposing client full names or avatars", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/providers/[id]/reviews/route.ts"),
      "utf8"
    );

    expect(source).toContain("KLYX_PUBLIC_REVIEW_PRIVACY_12B_12B");
    expect(source).toContain("publicAuthorName");
    expect(source).toContain('profile.first_name?.trim() || "Client"');
    expect(source).toContain("lastName.slice(0, 1).toUpperCase()");
    expect(source).toContain('authorAvatarUrl: null');

    expect(source).toContain('.select("id, first_name, last_name")');
    expect(source).not.toContain('full_name, avatar_url');
    expect(source).not.toContain('author?.full_name');
    expect(source).not.toContain('author?.avatar_url');

    expect(source).toContain('booking.status === "completed"');
    expect(source).toContain("verified: true");
    expect(source).toContain("KLYX_PROVIDER_PUBLIC_REVIEWS_LOAD_FAILED");
  });
});

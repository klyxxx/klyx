import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX public provider API error sanitization contract", () => {
  it("secures public provider review failures", () => {
    const source = read("app/api/providers/[id]/reviews/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain(
      'event: "provider_public_reviews_load_failed"'
    );
    expect(source).toContain(
      'code: "KLYX_PROVIDER_PUBLIC_REVIEWS_LOAD_FAILED"'
    );
    expect(source).not.toContain("reviewsError.message");
    expect(source).not.toContain("bookingsError.message");
    expect(source).not.toContain("profilesError.message");
  });

  it("secures public verified-service failures", () => {
    const source = read(
      "app/api/providers/[id]/verified-services/route.ts"
    );

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain(
      'event: "provider_public_verified_services_load_failed"'
    );
    expect(source).toContain(
      'code: "KLYX_PROVIDER_PUBLIC_VERIFIED_SERVICES_LOAD_FAILED"'
    );
    expect(source).not.toContain("error.message");
  });

  it("keeps provider review output public and verified", () => {
    const source = read("app/api/providers/[id]/reviews/route.ts");

    expect(source).toContain("averageRating");
    expect(source).toContain("reviewCount");
    expect(source).toContain("verified: true");
  });
});

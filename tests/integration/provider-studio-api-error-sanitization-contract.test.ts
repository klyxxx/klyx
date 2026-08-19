import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("provider studio API error sanitization contract", () => {
  it("keeps the provider studio core unchanged behind a secure public boundary", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/provider/studio/route.ts"),
      "utf8"
    );
    const core = readFileSync(
      join(process.cwd(), "app/api/provider/studio/studio-route-core.ts"),
      "utf8"
    );

    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain('event: "provider_studio_request_failed"');
    expect(route).toContain('route: "/api/provider/studio"');
    expect(route).toContain('code: "KLYX_PROVIDER_STUDIO_REQUEST_FAILED"');
    expect(route).toContain("if (response.status < 500)");
    expect(route).toContain('secureStudioResponse("GET"');
    expect(route).toContain('secureStudioResponse("PUT"');
    expect(route).toContain('secureStudioResponse("POST"');
    expect(route).toContain('secureStudioResponse("DELETE"');

    expect(core).toContain("createDefaultAvailability");
    expect(core).toContain("validatePublication");
    expect(core).toContain("provider_gallery");
    expect(core).toContain("provider_documents");
    expect(core).toContain("availability_slots");
    expect(core).not.toContain("secureApiErrorResponse");
  });
});

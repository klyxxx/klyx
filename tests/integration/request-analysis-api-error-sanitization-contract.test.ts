import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX request analysis API error sanitization contract", () => {
  it("keeps universal request analysis behind a secure 5xx boundary", () => {
    const source = read("app/api/requests/analyze/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./analyze-route-core"');
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"request_analysis_failed"');
    expect(source).toContain('"KLYX_REQUEST_ANALYSIS_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves universal request analysis while delegating memory audit to the shared server boundary", () => {
    const source = read("app/api/requests/analyze/analyze-route-core.ts");
    const memory = read("lib/client-memory-context.ts");

    expect(source).toContain("detectServiceCandidates");
    expect(source).toContain("missingFieldsForRequest");
    expect(source).toContain('from("service_requests")');
    expect(source).toContain('from "@/lib/client-memory-context"');
    expect(source).toContain("recordClientMemoryUsage");
    expect(memory).toContain('from("user_memory_events")');
    expect(memory).toContain('event_type: "memory_used"');
  });

  it("keeps photo POST and DELETE behind secure 5xx boundaries", () => {
    const source = read("app/api/requests/photo/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./photo-route-core"');
    expect(source).toContain("response.status < 500");
    expect(source).toContain('"photo_request_analysis_failed"');
    expect(source).toContain('"KLYX_PHOTO_REQUEST_ANALYSIS_FAILED"');
    expect(source).toContain('"photo_request_delete_failed"');
    expect(source).toContain('"KLYX_PHOTO_REQUEST_DELETE_FAILED"');
    expect(source).not.toContain("{ error: message }");
  });

  it("preserves photo ownership, storage and deletion logic unchanged in the core", () => {
    const source = read("app/api/requests/photo/photo-route-core.ts");

    expect(source).toContain('storagePath.startsWith(`${profile.id}/`)');
    expect(source).toContain('from("client-service-photos")');
    expect(source).toContain('from("photo_service_requests")');
    expect(source).toContain("analyzePhotoDescription");
    expect(source).toContain("export async function DELETE");
  });
});

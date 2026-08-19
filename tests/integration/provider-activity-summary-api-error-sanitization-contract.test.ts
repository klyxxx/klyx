import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX provider activity summary API error sanitization contract", () => {
  it("keeps the public GET route behind a secure 5xx boundary", () => {
    const source = read("app/api/provider/activity-summary/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('from "./activity-summary-core"');
    expect(source).toContain("secureCoreResponse(");
    expect(source).toContain("response.status < 500");
    expect(source).toContain('event: "provider_activity_summary_load_failed"');
    expect(source).toContain(
      'code: "KLYX_PROVIDER_ACTIVITY_SUMMARY_LOAD_FAILED"'
    );
    expect(source).not.toContain("apiErrorStatus(");
    expect(source).not.toContain("directBookingsResult.error.message");
  });

  it("preserves the no-automatic-execution contract on errors", () => {
    const source = read("app/api/provider/activity-summary/route.ts");

    expect(source).toContain("details: {");
    expect(source).toContain("automaticExecutionAllowed: false");
  });

  it("preserves group-aware mission semantics in the core", () => {
    const source = read(
      "app/api/provider/activity-summary/activity-summary-core.ts"
    );

    expect(source).toContain("KLYX_PROVIDER_GROUP_ACTIVITY_API_13_02");
    expect(source).toContain("KLYX_PROVIDER_ACTIVITY_GROUP_AWARE_13_02");
    expect(source).toContain("singleBookingEqualsMission:");
    expect(source).toContain("bookingGroupEqualsMission:");
    expect(source).toContain("groupChildrenCountAsExtraMissions:");
    expect(source).toContain("automaticExecutionAllowed:");
  });

  it("confines raw Supabase messages to the non-route core module", () => {
    const route = read("app/api/provider/activity-summary/route.ts");
    const core = read(
      "app/api/provider/activity-summary/activity-summary-core.ts"
    );

    expect(route).not.toContain("directBookingsResult.error.message");
    expect(route).not.toContain("legacyBookingsResult.error.message");
    expect(route).not.toContain("groupsResult.error.message");
    expect(core).toContain(".error.message");
  });
});

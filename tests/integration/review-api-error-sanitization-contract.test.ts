import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX review API error sanitization contract", () => {
  it("secures simple review failures and side effects", () => {
    const source = read("app/api/reviews/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureReviewError(");
    expect(source).toContain('"review_load_failed"');
    expect(source).toContain('"KLYX_REVIEW_LOAD_FAILED"');
    expect(source).toContain('"review_save_failed"');
    expect(source).toContain('"KLYX_REVIEW_SAVE_FAILED"');
    expect(source).toContain('"review_notification_failed"');
    expect(source).toContain('"KLYX_REVIEW_NOTIFICATION_FAILED"');
    expect(source).toContain('"review_score_recalculation_failed"');
    expect(source).toContain('"KLYX_REVIEW_SCORE_RECALCULATION_FAILED"');
    expect(source).not.toContain("console.error");
    expect(source).not.toContain("existingError.message");
    expect(source).not.toContain("providerResult.error.message");
  });

  it("keeps simple review domain errors public with explicit statuses", () => {
    const source = read("app/api/reviews/route.ts");

    expect(source).toContain('if (message === "Reservation introuvable.") return 404;');
    expect(source).toContain('if (message === "Prestataire introuvable.") return 404;');
    expect(source).toContain("return 403;");
    expect(source).toContain("return 409;");
    expect(source).toContain("publicMessage: status < 500 ? message : undefined");
  });

  it("secures grouped review failures and side effects", () => {
    const source = read("app/api/group-reviews/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureGroupReviewError(");
    expect(source).toContain('"group_review_load_failed"');
    expect(source).toContain('"KLYX_GROUP_REVIEW_LOAD_FAILED"');
    expect(source).toContain('"group_review_save_failed"');
    expect(source).toContain('"KLYX_GROUP_REVIEW_SAVE_FAILED"');
    expect(source).toContain('"group_review_notification_failed"');
    expect(source).toContain('"KLYX_GROUP_REVIEW_NOTIFICATION_FAILED"');
    expect(source).toContain('"group_review_score_recalculation_failed"');
    expect(source).toContain('"KLYX_GROUP_REVIEW_SCORE_RECALCULATION_FAILED"');
    expect(source).not.toContain("console.error");
    expect(source).not.toContain("groupError.message");
    expect(source).not.toContain("childError.message");
    expect(source).not.toContain("existingError.message");
  });

  it("keeps grouped review completion conflicts public", () => {
    const source = read("app/api/group-reviews/route.ts");

    expect(source).toContain("verifyCompletedGroup(");
    expect(source).toMatch(/status:\s*409/);
    expect(source).toContain('if (message === "Mission groupee introuvable.") return 404;');
    expect(source).toContain('if (message === "Prestataire KLYX introuvable.") return 404;');
  });
});

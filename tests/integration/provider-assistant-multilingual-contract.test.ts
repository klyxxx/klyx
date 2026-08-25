import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const core = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/provider/assistant/assistant-route-core.ts"
  ),
  "utf8"
);

const boundary = fs.readFileSync(
  path.join(process.cwd(), "app/api/provider/assistant/route.ts"),
  "utf8"
);

describe("KLYX provider assistant multilingual engine contract", () => {
  it("keeps POST as an explicit draft-preparation action", () => {
    expect(core).toContain("analyzeProviderAssistantMessage(");
    expect(core).toMatch(/body\.message\.trim\(\)\.slice\(0,\s*1000\)/);
    expect(core).toContain('result.intent !== "unknown"');
    expect(core).toContain('.from("provider_assistant_drafts")');
    expect(core).toContain('status: "draft"');
    expect(core).toContain("draftId,");
    expect(core).toContain("...result,");
  });

  it("keeps PATCH limited to explicit apply or discard", () => {
    expect(core).toContain('body.action === "apply"');
    expect(core).toContain('body.action === "discard"');
    expect(core).toContain('draft.status !== "draft"');
    expect(core).toContain('action === "discard"');
    expect(core).toContain('status: "discarded"');
  });

  it("keeps automatic application restricted to availability drafts", () => {
    expect(core).toContain('draft.draft_type !== "availability"');
    expect(core).toContain(
      "Les réponses et devis restent des brouillons à copier manuellement."
    );
    expect(core).toContain('.from("availability_slots")');
    expect(core).toContain(".delete()");
    expect(core).toContain(".insert({");
    expect(core).toContain('status: "applied"');
  });

  it("keeps provider ownership and role checks on every method", () => {
    expect(core.match(/getAuthenticatedProfile\(request\)/g)?.length).toBe(3);
    expect(core.match(/requireAccountType\(profile, "provider"\)/g)?.length).toBe(3);
    expect(core).toContain('.eq("profile_id", profile.id)');
  });

  it("does not introduce payment, booking, refund, or transfer execution", () => {
    for (const forbidden of [
      "payment_intent",
      "checkout",
      "refund",
      "transfer",
      'from("bookings")',
    ]) {
      expect(core.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("keeps the secure GET/POST/PATCH API boundary unchanged", () => {
    expect(boundary).toContain('secureBoundary("GET", coreGet, request)');
    expect(boundary).toContain('secureBoundary("POST", corePost, request)');
    expect(boundary).toContain('secureBoundary("PATCH", corePatch, request)');
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX Brain action presentation i18n contract", () => {
  it("localizes Brain action presentation from the existing KLYX locale cookie", () => {
    const route = read("app/api/brain/actions/route.ts");

    expect(route).toContain("KLYX_BRAIN_ACTION_PRESENTATION_I18N");
    expect(route).toContain("NextRequest");
    expect(route).toContain("KLYX_LANGUAGE_COOKIE_KEY");
    expect(route).toContain("normalizeKlyxLocale");
    expect(route).toContain("request.cookies.get(");
    expect(route).toContain("localizeKlyxBrainActions");
    expect(route).toContain("actions:");
    expect(route).toContain("localizedActions");
  });

  it("preserves the Brain action selection, priority, cancellation protection and safety flags", () => {
    const route = read("app/api/brain/actions/route.ts");

    expect(route).toContain("getBrainActions(");
    expect(route).toContain("getGroupCancellationBrainActions(");
    expect(route).toContain("protectedGroupHrefs");
    expect(route).toContain("second.priority -");
    expect(route).toContain("first.priority");
    expect(route).toContain(".slice(");
    expect(route).toContain("0,");
    expect(route).toContain("30");
    expect(route).toContain("automaticExecutionAllowed:");
    expect(route).toContain("false");
    expect(route).toContain("groupCancellationAware:");
    expect(route).toContain("true");
    expect(route).not.toContain("method: \"POST\"");
    expect(route).not.toContain("PaymentIntent");
    expect(route).not.toContain("checkout.sessions");
  });

  it("keeps canonical Brain generation and group cancellation logic untouched by presentation localization", () => {
    const brain = read("lib/brain-actions.ts");
    const cancellation = read("lib/brain-group-cancellation-actions.ts");

    expect(brain).toContain('kind: "compare_offers"');
    expect(brain).toContain('"payment-group-" + booking.booking_group_id');
    expect(brain).toContain('kind: "confirm_completion"');
    expect(brain).toContain('kind: "provider_finish_mission"');
    expect(brain).toMatch(/href:\s*"\/tracking\/"\s*\+/);
    expect(cancellation).toMatch(/kind:\s*"group_cancellation_decision"/);
    expect(cancellation).toMatch(/kind:\s*"group_refund_processing"/);
    expect(cancellation).toMatch(/kind:\s*"group_refund_failed"/);
    expect(cancellation).toContain("protectedGroupHrefs.add(");
  });

  it("keeps presentation localization pure and preserves semantic fields", () => {
    const helper = read("lib/klyx-brain-action-i18n.ts");

    expect(helper).toContain("KLYX_BRAIN_ACTION_TRANSLATED_LOCALES");
    expect(helper).toContain("localizeKlyxBrainAction");
    expect(helper).toContain("localizeKlyxBrainActions");
    expect(helper).toContain("description: action.description");
    expect(helper).toContain("return { ...action };");
    expect(helper).not.toContain("fetch(");
    expect(helper).not.toContain("supabase");
    expect(helper).not.toContain("stripe.");
  });
});

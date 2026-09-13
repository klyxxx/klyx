import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const handler = readFileSync(
  join(process.cwd(), "app/api/brain/converse/unified-intent.ts"),
  "utf8"
);

const groundedActionI18n = readFileSync(
  join(process.cwd(), "lib/klyx-grounded-action-i18n.ts"),
  "utf8"
);

describe("brain command grounded action i18n contract", () => {
  it("resolves the KLYX locale and localizes only the selected grounded action", () => {
    expect(handler).toContain('from "@/lib/klyx-server-i18n"');
    expect(handler).toContain("await getServerKlyxLocale()");
    expect(handler).toContain('from "@/lib/klyx-grounded-action-i18n"');
    expect(handler).toContain("localizeKlyxGroundedAction(action, locale)");
    expect(handler).toContain("automaticExecutionAllowed: false");
  });

  it("keeps action selection grounded in the existing server registry", () => {
    expect(handler).toContain("await getBrainActions(profile)");
    expect(handler).toContain("bestSpecificBrainCommandAction(actions, intent.normalizedMessage)");
    expect(handler).toContain("bestBrainCommandAction(actions, intent.normalizedMessage)");
    expect(handler).toContain("normalizeKlyxAssistantActionHref(localized.href)");
    expect(handler).not.toContain("payment_intents");
    expect(handler).not.toContain("checkout.sessions");
    expect(handler).not.toContain("refunds.create");
    expect(handler).not.toContain("/api/bookings/create");
  });

  it("keeps trusted copy and dynamic grounded content safe", () => {
    expect(groundedActionI18n).toContain("COPY[locale][value] ?? value");
    expect(groundedActionI18n).toContain('kind !== "compare_offers"');
    expect(groundedActionI18n).toContain('kind === "provider_offer_update"');
    expect(handler).toContain("title: localized.title");
    expect(handler).toContain("description: localized.description");
    expect(handler).toContain("kind: action.kind");
  });
});

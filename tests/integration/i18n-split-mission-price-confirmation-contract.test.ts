import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission price confirmation i18n contract", () => {
  it("uses the shared locale provider and dedicated certified dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPriceConfirmation.tsx"
    );

    expect(component).toContain("KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain("translateKlyxSplitMissionPriceConfirmation");
    expect(component).not.toContain("Vérification des montants");
    expect(component).not.toContain("Cette confirmation ne paie rien");
  });

  it("preserves authenticated no-store reads and explicit POST confirmation payload", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPriceConfirmation.tsx"
    );

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/prices"');
    expect(component).toContain('cache: "no-store"');
    expect(component).toContain('method: "POST"');
    expect(component).toContain("priceConfirmed: true");
    expect(component).toContain("overBudgetAcknowledged: overBudgetAccepted");
    expect(component).toContain('Authorization: "Bearer " + token');
  });

  it("keeps over-budget acknowledgement and confirmation as explicit user actions", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPriceConfirmation.tsx"
    );

    expect(component).toContain('type="checkbox"');
    expect(component).toContain("event.target.checked");
    expect(component).toContain("!overBudgetAccepted");
    expect(component).toContain("onClick={() => void confirmPrices()}");
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
  });

  it("does not reflect backend price errors and adds no payment mutation", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionPriceConfirmation.tsx"
    );
    const helper = read("lib/klyx-split-mission-price-confirmation-i18n.ts");

    expect(component).not.toContain("body.error");
    expect(component).not.toContain("error.message");
    expect(component.toLowerCase()).not.toContain("stripe");
    expect(component).not.toContain("payment_intent");
    expect(helper).toContain("Cette confirmation ne paie rien");
    expect(helper).toContain("This confirmation pays nothing");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "app/api/brain/command/route.ts"),
  "utf8"
);

const groundedActionI18n = readFileSync(
  join(process.cwd(), "lib/klyx-grounded-action-i18n.ts"),
  "utf8"
);

describe("brain command grounded action i18n contract", () => {
  it("resolves the KLYX locale on the server and localizes only the selected action", () => {
    expect(route).toContain('from "@/lib/klyx-server-i18n"');
    expect(route).toContain("await getServerKlyxLocale()");
    expect(route).toContain('from "@/lib/klyx-grounded-action-i18n"');
    expect(route).toContain("localizeKlyxGroundedAction(");
    expect(route).toContain('mode:\n            "existing_action"');
    expect(route).toContain("automaticExecutionAllowed:\n            false");
  });

  it("keeps action selection grounded in the existing server registry", () => {
    expect(route).toContain("await getBrainActions(");
    expect(route).toContain("bestBrainCommandAction(");
    expect(route).not.toContain("payment_intents");
    expect(route).not.toContain("checkout.sessions");
    expect(route).not.toContain("refunds.create");
    expect(route).not.toContain("/api/bookings/create");
  });

  it("keeps unknown trusted copy and dynamic user request titles safe", () => {
    expect(groundedActionI18n).toContain("COPY[locale][value] ?? value");
    expect(groundedActionI18n).toContain('kind !== "compare_offers"');
    expect(groundedActionI18n).toContain('kind === "provider_offer_update"');
    expect(route).toContain('action.kind === "compare_offers"');
    expect(route).toContain("description:\n                    action.description");
  });
});

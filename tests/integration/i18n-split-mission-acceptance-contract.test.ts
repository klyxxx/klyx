import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX split mission acceptance i18n contract", () => {
  it("uses the shared KLYX locale provider and certified acceptance dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionAcceptance.tsx"
    );

    expect(component).toContain("KLYX_SPLIT_MISSION_ACCEPTANCE_I18N");
    expect(component).toContain("useKlyxLocale");
    expect(component).toContain('from "@/app/components/KlyxLocaleProvider"');
    expect(component).toContain("translateKlyxSplitMissionAcceptance");
    expect(component).toContain("useKlyxLocale();");
    expect(component).not.toContain("Acceptation de la mission");
    expect(component).not.toContain("Vérification des réponses des prestataires");
  });

  it("preserves acceptance as a no-store authenticated GET-only read", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionAcceptance.tsx"
    );

    expect(component).toContain("supabase.auth.getSession()");
    expect(component).toContain('"/api/bookings/split-missions/"');
    expect(component).toContain('"/acceptance"');
    expect(component).toContain('"no-store"');
    expect(component).toContain('"Bearer " +');
    expect(component).not.toContain("method:");
    expect(component).not.toContain("stripe");
  });

  it("keeps refresh and plan review explicit user actions without automatic retry", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionAcceptance.tsx"
    );

    expect(component).toContain("void load()");
    expect(component).toContain("<RefreshCw");
    expect(component).toContain('"/assistant/market/"');
    expect(component).toContain('"/split-plan"');
    expect(component).not.toContain("setInterval(");
    expect(component).not.toContain("setTimeout(");
  });

  it("keeps financial and replacement safety wording inside the certified dictionary", () => {
    const component = read(
      "app/bookings/split/[id]/SplitMissionAcceptance.tsx"
    );
    const helper = read("lib/klyx-split-mission-acceptance-i18n.ts");

    expect(component).not.toContain("aucun paiement n'est automatique");
    expect(component).not.toContain("jamais silencieusement");
    expect(helper).toContain("aucun paiement n'est automatique");
    expect(helper).toContain("no payment is automatic");
    expect(helper).toContain("KLYX ne le remplace jamais silencieusement");
    expect(helper).toContain("KLYX never replaces them silently");
    expect(helper).toContain("Réservation automatique : non");
    expect(helper).toContain("Automatic booking: no");
  });
});

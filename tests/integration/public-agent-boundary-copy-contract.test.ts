import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const home = readRepoFile("app/page.tsx");
const recoveryGuide = readRepoFile("docs/KLYX_RECOVERY_GUIDE.md");

const publicBoundarySources = [home, recoveryGuide].join("\n");

describe("KLYX public agent transaction-boundary copy", () => {
  it("allows reversible search/choice while keeping engaging transactions explicit", () => {
    expect(home).toContain(
      "KLYX peut comparer et retenir une recommandation. Tu confirmes explicitement avant toute réservation."
    );
    expect(home).toContain(
      "Publication de demande, réservation, paiement, annulation et remboursement restent soumis à une action explicite de ta part."
    );
    expect(home).toContain(
      "laisse KLYX comparer les prestataires"
    );

    expect(recoveryGuide).toContain(
      "searching providers and choosing a candidate"
    );
    expect(recoveryGuide).toContain(
      "Booking and payment remain separate boundaries"
    );
  });

  it("does not reintroduce the obsolete provider-selection confirmation invariant", () => {
    expect(publicBoundarySources).not.toContain(
      "Aucune publication de demande, sélection de prestataire"
    );
    expect(publicBoundarySources).not.toContain(
      "le choix du prestataire et la réservation restent sous ton contrôle"
    );
    expect(publicBoundarySources).not.toContain(
      "automaticExecutionAllowed = false"
    );
  });
});

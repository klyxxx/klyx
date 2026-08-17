import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_AI_FIRST_SECONDARY_UI_CONTRACT_15_04

function read(
  relative: string
) {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      relative
    ),
    "utf8"
  );
}

describe(
  "KLYX AI-first secondary UI",
  () => {
    it(
      "keeps secondary flows compact without removing security information",
      () => {
        const onboarding =
          read(
            "app/onboarding/page.tsx"
          );

        const assistant =
          read(
            "app/provider/assistant/page.tsx"
          );

        const jobs =
          read(
            "app/provider/jobs/page.tsx"
          );

        const finance =
          read(
            "app/provider/payments/page.tsx"
          );

        const verification =
          read(
            "app/provider/verification/page.tsx"
          );

        const privacy =
          read(
            "app/settings/PhonePrivacyControls.tsx"
          );

        const history =
          read(
            "app/settings/PhoneAccessHistory.tsx"
          );

        expect(onboarding).toContain(
          "KLYX_AI_FIRST_ONBOARDING_15_04"
        );

        expect(assistant).toContain(
          "KLYX_AI_FIRST_PROVIDER_ASSISTANT_15_04"
        );

        expect(jobs).toContain(
          "KLYX_AI_FIRST_PROVIDER_JOBS_15_04"
        );

        expect(finance).toContain(
          "KLYX_AI_FIRST_PROVIDER_FINANCE_15_04"
        );

        expect(jobs).toContain(
          "Tous les créneaux doivent être couverts. Une offre = mission complète."
        );

        expect(finance).toContain(
          "Journal KLYX · paiements traités par Stripe."
        );

        expect(onboarding).not.toContain(
          "Ton profil et tes services restent sous ton contrôle."
        );

        expect(assistant).not.toContain(
          "Prépare tes disponibilités, devis et réponses"
        );

        expect(jobs).not.toContain(
          "KLYX suit les offres que tu as déjà envoyées."
        );

        expect(verification).toContain(
          "Documents privés et sensibles"
        );

        expect(privacy).toContain(
          "Confidentialite du telephone"
        );

        expect(history).toContain(
          "Aucun numero de telephone ni code SMS OTP n y apparait."
        );
      }
    );
  }
);
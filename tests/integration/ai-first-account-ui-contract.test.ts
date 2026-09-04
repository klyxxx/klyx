import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_AI_FIRST_ACCOUNT_UI_CONTRACT_15_03

function read(relative: string) {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      relative
    ),
    "utf8"
  );
}

describe(
  "KLYX AI-first account UI",
  () => {
    it(
      "keeps account and provider screens action-first",
      () => {
        const studio =
          read(
            "app/components/ProviderStudio.tsx"
          );

        const studioI18n =
          read(
            "lib/klyx-provider-studio-i18n.ts"
          );

        const requests =
          read(
            "app/requests/page.tsx"
          );

        const quotes =
          read(
            "app/quotes/page.tsx"
          );

        const profile =
          read(
            "app/profile/page.tsx"
          );

        const settings =
          read(
            "app/settings/page.tsx"
          );

        const settingsI18n =
          read(
            "lib/klyx-settings-page-i18n.ts"
          );

        expect(studio).toContain(
          "KLYX_AI_FIRST_PROVIDER_STUDIO_15_03"
        );

        expect(requests).toContain(
          "KLYX_AI_FIRST_REQUESTS_15_03"
        );

        expect(quotes).toContain(
          "KLYX_AI_FIRST_QUOTES_15_03"
        );

        expect(profile).toContain(
          "KLYX_AI_FIRST_PROFILE_15_03"
        );

        expect(settings).toContain(
          "KLYX_AI_FIRST_SETTINGS_15_03"
        );

        expect(studio).not.toContain(
          "Construis une fiche qui donne confiance"
        );

        expect(requests).not.toContain(
          "RequestJourneyStep"
        );

        expect(requests).not.toContain(
          "Après publication"
        );

        expect(quotes).not.toContain(
          "Compare les estimations et les montants confirmés"
        );

        expect(profile).not.toContain(
          "Une photo claire augmente la confiance"
        );

        expect(settings).not.toContain(
          "Confirmations, changements de statut"
        );

        expect(requests).toContain(
          "Confirmer et publier la demande"
        );

        expect(requests).toContain(
          "Choisir ce prestataire"
        );

        expect(quotes).toContain(
          "Accepter le devis"
        );

        expect(studio).toContain(
          'title={t("documentsTitle")}'
        );

        expect(studio).toContain(
          '{t("identityRequired")}'
        );

        expect(studioI18n).toContain(
          'documentsTitle: "Documents"'
        );

        expect(studioI18n).toContain(
          'identityRequired:'
        );

        expect(studioI18n).toContain(
          '"Une pièce d’identité est nécessaire avant la publication."'
        );

        expect(settings).toContain(
          't("deleteForever")'
        );

        expect(settings).toContain(
          'const DELETE_CONFIRMATION = "SUPPRIMER"'
        );

        expect(settingsI18n).toContain(
          'deleteForever: "Supprimer définitivement"'
        );
      }
    );
  }
);
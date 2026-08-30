import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

// KLYX_AI_FIRST_CORE_UI_CONTRACT_15_02

function read(
  relativePath: string
) {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      relativePath
    ),
    "utf8"
  );
}

describe(
  "KLYX AI-first core UI",
  () => {
    it(
      "keeps main user screens compact and action-focused",
      () => {
        const dashboard =
          read(
            "app/dashboard/page.tsx"
          );

        const bookings =
          read(
            "app/bookings/page.tsx"
          );

        const search =
          read(
            "app/search/page.tsx"
          );

        const assistant =
          read(
            "app/assistant/market/page.tsx"
          );

        const readiness =
          read(
            "app/components/ProviderReadinessStatus.tsx"
          );

        expect(
          dashboard
        ).toContain(
          "redirect(getKlyxAccountHome(profile.accountType));"
        );

        expect(
          dashboard
        ).not.toContain(
          "<main"
        );

        expect(
          dashboard
        ).not.toContain(
          "KLYX_AI_FIRST_DASHBOARD_15_02"
        );

        expect(
          bookings
        ).toContain(
          't("nextStepKlyx")'
        );

        expect(
          search
        ).toContain(
          "KLYX_AI_FIRST_SEARCH_15_02"
        );

        expect(
          assistant
        ).toContain(
          "KLYX_AI_FIRST_ASSISTANT_15_02"
        );

        expect(
          readiness
        ).toContain(
          "KLYX_AI_FIRST_PROVIDER_READINESS_15_02"
        );

        expect(
          dashboard
        ).not.toContain(
          "Accède directement aux opportunités compatibles"
        );

        expect(
          bookings
        ).not.toContain(
          "Une mission multi-creneaux apparait maintenant"
        );

        expect(
          search
        ).not.toContain(
          "Parcours assisté"
        );

        expect(
          search
        ).not.toContain(
          "Parcours manuel"
        );

        expect(
          assistant
        ).not.toContain(
          "Ton parcours KLYX"
        );

        expect(
          assistant
        ).not.toContain(
          "Toujours sous ton contrôle"
        );

        expect(
          readiness
        ).not.toContain(
          "Ton profil possède les éléments essentiels de visibilité"
        );

        expect(
          assistant
        ).toContain(
          "Dis-moi ce qu’il te faut. Je m’occupe du reste avec toi."
        );
      }
    );
  }
);
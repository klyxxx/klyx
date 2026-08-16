import {
  expect,
  test,
  type Page,
} from "@playwright/test";

const email =
  process.env.KLYX_E2E_EMAIL?.trim();

const password =
  process.env.KLYX_E2E_PASSWORD;

/*
 * KLYX_E2E_SENSITIVE_ARTIFACT_GUARD_PHASE_7D_1
 *
 * Ce fichier manipule un mot de passe E2E.
 * Aucun screenshot, trace ou video.
 */
test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  accountType:
    | "client"
    | "provider";
};

type ProfilesState = {
  profiles: Profile[];
  activeProfileId: string | null;
};

function fullName(
  profile: Profile
) {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

async function clearSensitivePassword(
  page: Page
) {
  try {
    await page
      .locator(
        'input[type="password"]'
      )
      .evaluateAll(
        (inputs) => {
          for (
            const input of inputs
          ) {
            const element =
              input as HTMLInputElement;

            element.value = "";

            element.removeAttribute(
              "value"
            );

            element.dispatchEvent(
              new Event(
                "input",
                {
                  bubbles: true,
                }
              )
            );
          }
        }
      );
  } catch {
    // Le champ peut déjà avoir disparu.
  }
}

async function readProfiles(
  page: Page
): Promise<ProfilesState> {
  return page.evaluate(
    async () => {
      const response =
        await fetch(
          "/api/profiles/active",
          {
            cache:
              "no-store",
          }
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Profiles API failed."
        );
      }

      return body;
    }
  );
}

async function forceActiveProfile(
  page: Page,
  profileId: string
) {
  await page.evaluate(
    async (id) => {
      const response =
        await fetch(
          "/api/profiles/active",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                profileId:
                  id,
              }),
          }
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Profile switch failed."
        );
      }
    },
    profileId
  );
}

async function switchThroughUi(
  page: Page,
  current: Profile,
  target: Profile
) {
  const currentPattern =
    new RegExp(
      escapeRegExp(
        fullName(current)
      ),
      "i"
    );

  const targetPattern =
    new RegExp(
      escapeRegExp(
        fullName(target)
      ),
      "i"
    );

  await page
    .getByRole(
      "button",
      {
        name:
          currentPattern,
      }
    )
    .first()
    .click();

  await page
    .getByRole(
      "menuitem",
      {
        name:
          targetPattern,
      }
    )
    .click();
}

test.describe(
  "KLYX authenticated multi-profile",
  () => {
    test.skip(
      !email || !password,
      "Dedicated KLYX E2E credentials are not configured."
    );

    test.afterEach(
      async ({ page }) => {
        await clearSensitivePassword(
          page
        );
      }
    );

    test(
      "login, switch client/provider and keep the session",
      async ({ page }) => {
        /*
         * KLYX_AUTH_E2E_TIMEOUT_PHASE_7D_1
         *
         * Le parcours authentifié traverse
         * plusieurs routes/API réelles Supabase.
         * Les compilations à froid Next.js
         * peuvent dépasser 30 secondes.
         *
         * Les tests publics restent à 30 s.
         */
        test.setTimeout(
          120_000
        );

        await page.goto(
          "/login"
        );

        const emailInput =
          page.getByPlaceholder(
            "vous@exemple.com"
          );

        const passwordInput =
          page.getByPlaceholder(
            "Votre mot de passe"
          );

        const loginButton =
          page.getByRole(
            "button",
            {
              name:
                "Se connecter",
            }
          );

        await emailInput.fill(
          email!
        );

        await passwordInput.fill(
          password!
        );

        try {
          await loginButton.click();
        } finally {
          await clearSensitivePassword(
            page
          );
        }

        await expect(
          page
        ).toHaveURL(
          /\/dashboard(?:\?|$)/,
          {
            timeout:
              20_000,
          }
        );

        const initial =
          await readProfiles(
            page
          );

        const client =
          initial.profiles.find(
            (profile) =>
              profile.accountType ===
              "client"
          );

        const provider =
          initial.profiles.find(
            (profile) =>
              profile.accountType ===
              "provider"
          );

        expect(
          client,
          "Dedicated E2E client profile is missing."
        ).toBeTruthy();

        expect(
          provider,
          "Dedicated E2E provider profile is missing."
        ).toBeTruthy();

        await forceActiveProfile(
          page,
          client!.id
        );

        await page.goto(
          "/dashboard"
        );

        await expect(
          page.getByText(
            "Organise ton prochain besoin."
          )
        ).toBeVisible();

        await switchThroughUi(
          page,
          client!,
          provider!
        );

        await expect(
          page.getByText(
            "Trouve ta prochaine mission."
          )
        ).toBeVisible({
          timeout:
            20_000,
        });

        const providerState =
          await readProfiles(
            page
          );

        expect(
          providerState.activeProfileId
        ).toBe(
          provider!.id
        );

        await page.reload();

        await expect(
          page.getByText(
            "Trouve ta prochaine mission."
          )
        ).toBeVisible();

        const afterReload =
          await readProfiles(
            page
          );

        expect(
          afterReload.activeProfileId
        ).toBe(
          provider!.id
        );

        await page.goto(
          "/login"
        );

        await expect(
          page
        ).toHaveURL(
          /\/dashboard(?:\?|$)/,
          {
            timeout:
              20_000,
          }
        );

        await switchThroughUi(
          page,
          provider!,
          client!
        );

        await expect(
          page.getByText(
            "Organise ton prochain besoin."
          )
        ).toBeVisible({
          timeout:
            20_000,
        });

        const finalState =
          await readProfiles(
            page
          );

        expect(
          finalState.activeProfileId
        ).toBe(
          client!.id
        );
      }
    );
  }
);
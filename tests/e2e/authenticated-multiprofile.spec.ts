import {
  expect,
  test,
  type Page,
} from "@playwright/test";

const email =
  process.env.KLYX_E2E_EMAIL?.trim();

const password =
  process.env.KLYX_E2E_PASSWORD;

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

    test(
      "login, switch client/provider and keep the session",
      async ({ page }) => {
        await page.goto(
          "/login"
        );

        await page
          .getByPlaceholder(
            "vous@exemple.com"
          )
          .fill(email!);

        await page
          .getByPlaceholder(
            "Votre mot de passe"
          )
          .fill(password!);

        await page
          .getByRole(
            "button",
            {
              name:
                "Se connecter",
            }
          )
          .click();

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

        /*
         * La sélection du profil doit
         * survivre à un rechargement réel.
         */
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

        /*
         * La session Auth doit également
         * être toujours active.
         *
         * /login doit donc renvoyer
         * automatiquement vers /dashboard.
         */
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
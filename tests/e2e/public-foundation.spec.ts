import {
  expect,
  test,
} from "@playwright/test";

test.describe(
  "KLYX public foundation",
  () => {
    test(
      "homepage presents the KLYX product promise",
      async ({ page }) => {
        const response =
          await page.goto("/");

        expect(
          response?.ok()
        ).toBeTruthy();

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "KLYX organise les services du quotidien à ta place.",
            }
          )
        ).toBeVisible();

        await expect(
          page.getByText(
            "Baby-sitting",
            {
              exact: true,
            }
          )
        ).toBeVisible();

        await expect(
          page.getByText(
            "Ménage",
            {
              exact: true,
            }
          )
        ).toBeVisible();

        await expect(
          page.getByText(
            "Déménagement",
            {
              exact: true,
            }
          )
        ).toBeVisible();

        await expect(
          page.getByText(
            "Bricolage",
            {
              exact: true,
            }
          )
        ).toBeVisible();
      }
    );

    test(
      "login page exposes the authentication form",
      async ({ page }) => {
        await page.goto(
          "/login"
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Connexion à KLYX",
            }
          )
        ).toBeVisible();

        await expect(
          page.getByPlaceholder(
            "vous@exemple.com"
          )
        ).toBeVisible();

        await expect(
          page.getByPlaceholder(
            "Votre mot de passe"
          )
        ).toBeVisible();

        await expect(
          page.getByRole(
            "button",
            {
              name:
                "Se connecter",
            }
          )
        ).toBeVisible();
      }
    );

    test(
      "provider signup keeps provider intent",
      async ({ page }) => {
        await page.goto(
          "/signup?type=provider"
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Commencer avec KLYX",
            }
          )
        ).toBeVisible();

        await expect(
          page.getByText(
            "Je rejoins KLYX comme prestataire",
            {
              exact: true,
            }
          )
        ).toBeVisible();

        await expect(
          page.getByRole(
            "button",
            {
              name:
                "Créer mon espace prestataire",
            }
          )
        ).toBeVisible();
      }
    );

    test(
      "anonymous visitor cannot open dashboard",
      async ({ page }) => {
        await page.goto(
          "/dashboard"
        );

        await expect(
          page
        ).toHaveURL(
          /\/login\?redirect=%2Fdashboard/
        );

        await expect(
          page.getByRole(
            "heading",
            {
              name:
                "Connexion à KLYX",
            }
          )
        ).toBeVisible();
      }
    );
  }
);
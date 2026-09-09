import { expect, test } from "@playwright/test";

import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

const conversationId = "11111111-1111-4111-8111-111111111111";

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("KLYX Assistant Phase B D01-D03", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps need, clarification and ready-for-search in one thread", async ({ page }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    await page.route("**/api/brain/command", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mode: "new_request" }),
      });
    });

    let converseCalls = 0;
    await page.route("**/api/brain/converse", async (route) => {
      converseCalls += 1;

      if (converseCalls === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversationId,
            reply:
              "Demande en cours (50 %) - 2 informations restantes\n\nJ’ai déjà compris : ménage demain. Dans quelle ville ou commune ?",
            payload: {
              serviceSlug: "menage",
              city: null,
              date: "2026-09-09",
              time: null,
              budget: null,
              missing: ["ville", "heure"],
              ready: false,
              readiness: {
                nextMissing: "ville",
                summary: null,
              },
            },
          }),
        });
        return;
      }

      if (converseCalls === 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversationId,
            reply:
              "Presque prête (75 %) - 1 information restante\n\nJ’ai compris Bruxelles. À quel moment souhaitez-vous la prestation ?",
            payload: {
              serviceSlug: "menage",
              city: "Bruxelles",
              date: "2026-09-09",
              time: null,
              budget: null,
              missing: ["heure"],
              ready: false,
              readiness: {
                nextMissing: "heure",
                summary: null,
              },
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId,
          reply:
            "Demande complète (100 %)\n\nService: menage | Ville: Bruxelles | Date: 2026-09-09 | Heure: 14:00\n\nTa demande est complète. Vérifie le résumé puis confirme avant toute publication, réservation ou paiement.",
          payload: {
            serviceSlug: "menage",
            city: "Bruxelles",
            date: "2026-09-09",
            time: "14:00",
            budget: null,
            missing: [],
            ready: true,
            readiness: {
              nextMissing: null,
              summary: {
                service: "menage",
                city: "Bruxelles",
                date: "2026-09-09",
                time: "14:00",
              },
            },
          },
        }),
      });
    });

    await page.goto("/assistant");

    const thread = page.getByTestId("assistant-thread");
    await expect(thread).toHaveAttribute("data-state", "empty");
    await expect(
      thread.getByRole("heading", { name: "Que puis-je organiser pour vous ?" })
    ).toBeVisible();
    await expect(thread.getByText("En cours", { exact: true })).toHaveCount(0);
    await expect(thread.getByText("Notifications", { exact: true })).toHaveCount(0);

    const composer = thread.getByTestId("assistant-composer");
    const input = composer.getByPlaceholder("De quoi avez-vous besoin ?");
    await input.fill("J’ai besoin d’un ménage demain");
    await expect(thread).toHaveAttribute("data-state", "typing");
    await input.press("Enter");

    const conversation = thread.getByLabel("Conversation KLYX");
    await expect(thread.getByText("J’ai besoin d’un ménage demain", { exact: true })).toBeVisible();
    await expect(conversation.getByText(/Dans quelle ville ou commune \?/)).toBeVisible();
    await expect(thread).toHaveAttribute("data-state", "clarification_needed");
    await expect(page).toHaveURL(new RegExp(`conversation=${conversationId}`));
    await expect(thread.getByText(/50\s*%/)).toHaveCount(0);
    await expect(thread.getByText(/informations? restantes?/i)).toHaveCount(0);

    const followUp = thread.getByPlaceholder("Répondez simplement à KLYX…");
    await followUp.fill("Bruxelles");
    await followUp.press("Enter");

    await expect(conversation.getByText(/À quel moment souhaitez-vous la prestation \?/)).toBeVisible();
    await expect(thread.getByRole("button", { name: "L’après-midi" })).toBeVisible();
    await thread.getByRole("button", { name: "L’après-midi" }).click();

    await expect(thread.getByTestId("ready-for-search-summary")).toContainText(
      "Je peux chercher maintenant."
    );
    await expect(thread).toHaveAttribute("data-state", "ready_for_search");
    await expect(thread.getByText(/100\s*%/)).toHaveCount(0);
    await expect(thread.getByText(/Vérifie le résumé puis confirme/)).toHaveCount(0);
    await expect(thread.getByRole("button", { name: /Confirmer/i })).toHaveCount(0);
    await expect(thread.getByRole("button", { name: /Rechercher/i })).toHaveCount(0);
    expect(converseCalls).toBe(3);
  });

  test("keeps the conversation anchor on HTTP 429 and does not retry automatically", async ({ page }) => {
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "client");

    let converseCalls = 0;
    await page.route("**/api/brain/converse", async (route) => {
      converseCalls += 1;
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Too many requests" }),
      });
    });

    await page.goto(`/assistant?conversation=${conversationId}`);
    const thread = page.getByTestId("assistant-thread");
    const composer = thread.getByTestId("assistant-composer");
    const input = composer.getByPlaceholder("Répondez simplement à KLYX…");

    await input.fill("Je précise ma demande");
    await input.press("Enter");

    await expect(thread.getByRole("alert")).toContainText("trop de demandes");
    await expect(thread.getByText("Je précise ma demande", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`conversation=${conversationId}`));
    expect(converseCalls).toBe(1);
  });
});

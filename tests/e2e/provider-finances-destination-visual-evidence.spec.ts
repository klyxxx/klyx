import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activateKlyxE2EProfile,
  clearSensitivePassword,
  hasE2ECredentials,
  loginKlyxE2E,
} from "./helpers/authenticated-session";

async function attachViewport(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", fullPage: true }),
    contentType: "image/png",
  });
}

const financePayload = {
  summary: {
    currency: "EUR",
    grossPaidCents: 100000,
    platformFeeCents: 20000,
    providerAmountCents: 80000,
    refundedCents: 6000,
    refundsProcessingCents: 0,
    successfulPayments: 4,
    failedPayments: 0,
    successfulRefunds: 1,
  },
  transactions: [
    {
      id: "finance-e2e-1",
      bookingId: "11111111-1111-1111-1111-111111111111",
      bookingDate: "2026-09-01",
      bookingStatus: "confirmed",
      entryType: "payment_succeeded",
      status: "succeeded",
      currency: "EUR",
      grossAmountCents: 30000,
      platformFeeCents: 6000,
      providerAmountCents: 24000,
      refundAmountCents: 0,
      paymentMode: "live",
      stripePaymentIntentId: "pi_e2e_1",
      stripeRefundId: null,
      failureCode: null,
      failureMessage: null,
      createdAt: "2026-09-02T08:30:00.000Z",
    },
    {
      id: "finance-e2e-2",
      bookingId: "22222222-2222-2222-2222-222222222222",
      bookingDate: "2026-08-31",
      bookingStatus: "confirmed",
      entryType: "refund_succeeded",
      status: "succeeded",
      currency: "EUR",
      grossAmountCents: 0,
      platformFeeCents: 0,
      providerAmountCents: null,
      refundAmountCents: 6000,
      paymentMode: "live",
      stripePaymentIntentId: "pi_e2e_2",
      stripeRefundId: "re_e2e_2",
      failureCode: null,
      failureMessage: null,
      createdAt: "2026-09-01T10:00:00.000Z",
    },
  ],
};

const stripePayload = {
  connected: true,
  onboardingComplete: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  runtimeMode: "live",
  livePaymentsEnabled: true,
  countryCode: "BE",
  marketCommerciallyReady: true,
  stripeConfigured: true,
  connectSetupAllowed: true,
  livePaymentsOperational: true,
};

test.describe("KLYX provider Finances destination", () => {
  test.skip(
    !hasE2ECredentials,
    "Dedicated KLYX E2E credentials are not configured."
  );

  test.afterEach(async ({ page }) => {
    await clearSensitivePassword(page);
  });

  test("keeps finances calm on desktop and mobile", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await loginKlyxE2E(page);
    await activateKlyxE2EProfile(page, "provider");

    await page.route("**/api/stripe/connect/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(stripePayload),
      });
    });

    await page.route("**/api/provider/finance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(financePayload),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/provider/payments", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Ton argent, sans détour." })
    ).toBeVisible();
    await expect(page.getByText("740,00 €", { exact: true })).toBeVisible();
    await expect(page.getByText("Transactions récentes")).toBeVisible();
    await expect(page.getByText("Détails du compte de paiement")).toBeVisible();
    await expect(page.getByText("Compte prêt à recevoir des paiements", { exact: false })).toBeVisible();

    await attachViewport(page, testInfo, "provider-finances-focused-desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-navigation")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ton argent, sans détour." })
    ).toBeVisible();

    await attachViewport(page, testInfo, "provider-finances-focused-mobile");
  });
});

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

async function requestJson({ appOrigin, accessToken, profileId, path }) {
  const response = await fetch(`${appOrigin}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
      "Content-Type": "application/json",
    },
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`GET ${path} returned non-JSON status ${response.status}.`);
    }
  }

  if (!response.ok) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";
    throw new Error(`GET ${path} returned ${response.status}: ${safeMessage}`);
  }

  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path provider finance proof is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path provider finance proof requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the golden-path KLYX account.");
  }

  const accessToken = signInData.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(`Unable to load golden-path profiles: ${profilesError.message}`);
  }

  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!provider) {
    throw new Error("Golden-path provider profile is missing.");
  }

  const { data: completedBooking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, provider_id, status, payment_status, service_status, amount_total, currency, payment_mode"
    )
    .eq("provider_id", provider.id)
    .eq("status", "completed")
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !completedBooking) {
    throw new Error(
      `Unable to locate the completed paid golden-path booking: ${
        bookingError?.message ?? "missing booking"
      }`
    );
  }

  if (
    completedBooking.service_status !== "completed" ||
    Number(completedBooking.amount_total) !== 7000 ||
    completedBooking.currency !== "EUR" ||
    completedBooking.payment_mode !== "platform_test_only"
  ) {
    throw new Error("Completed golden-path booking is not finance-ready.");
  }

  const finance = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/provider/finance",
  });

  const summary = finance?.summary;
  if (
    summary?.currency !== "EUR" ||
    Number(summary?.grossPaidCents) !== 7000 ||
    Number(summary?.platformFeeCents) !== 0 ||
    Number(summary?.providerAmountCents) !== 0 ||
    Number(summary?.refundedCents) !== 0 ||
    Number(summary?.refundsProcessingCents) !== 0 ||
    Number(summary?.successfulPayments) !== 1 ||
    Number(summary?.failedPayments) !== 0 ||
    Number(summary?.successfulRefunds) !== 0 ||
    summary?.countsGroupAware !== true ||
    summary?.amountsCanonicalized !== true
  ) {
    throw new Error(
      `Provider finance summary is invalid: ${JSON.stringify(summary)}`
    );
  }

  if (!Array.isArray(finance?.transactions) || finance.transactions.length !== 1) {
    throw new Error("Provider finance must expose exactly one commercial transaction.");
  }

  const transaction = finance.transactions[0];
  if (
    transaction.bookingId !== completedBooking.id ||
    transaction.entryType !== "payment_succeeded" ||
    transaction.status !== "succeeded" ||
    transaction.currency !== "EUR" ||
    Number(transaction.grossAmountCents) !== 7000 ||
    Number(transaction.platformFeeCents) !== 0 ||
    transaction.providerAmountCents !== null ||
    Number(transaction.refundAmountCents) !== 0 ||
    transaction.paymentMode !== "platform_test_only" ||
    transaction.bookingStatus !== "completed"
  ) {
    throw new Error(
      `Provider finance transaction is invalid: ${JSON.stringify(transaction)}`
    );
  }

  const reconciliation = finance?.reconciliation;
  if (
    reconciliation?.checked !== true ||
    reconciliation?.reconciled !== true ||
    reconciliation?.status !== "ok" ||
    reconciliation?.readOnly !== true ||
    reconciliation?.ledgerModified !== false ||
    reconciliation?.stripeModified !== false ||
    reconciliation?.automaticCorrection !== false
  ) {
    throw new Error(
      `Provider finance reconciliation is invalid: ${JSON.stringify(reconciliation)}`
    );
  }

  if (finance?.automaticExecutionAllowed !== false) {
    throw new Error("Provider finance unexpectedly allows automatic execution.");
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      providerFinanceVerified: true,
      bookingId: completedBooking.id,
      grossPaidCents: Number(summary.grossPaidCents),
      currency: summary.currency,
      successfulPayments: Number(summary.successfulPayments),
      reconciliationStatus: reconciliation.status,
      payoutClaimed: false,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path provider finance failed: ${message}`);
  process.exitCode = 1;
});

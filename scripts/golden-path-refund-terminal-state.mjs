import { randomUUID } from "node:crypto";

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
  const payload = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(
      `GET ${path} returned ${response.status}: ${payload?.error ?? "unexpected response"}`
    );
  }

  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path refund terminal proof is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path refund terminal proof requires the isolated local KLYX server."
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
    throw new Error("Unable to authenticate the refund terminal proof account.");
  }

  const accessToken = signInData.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(`Unable to load refund proof profiles: ${profilesError.message}`);
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Refund proof client/provider profiles are missing.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, status, payment_status, amount_total, currency, refund_status, refunded_amount_cents"
    )
    .eq("provider_id", provider.id)
    .eq("status", "completed")
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error(
      `Unable to locate completed paid booking for refund proof: ${
        bookingError?.message ?? "missing booking"
      }`
    );
  }

  if (Number(booking.amount_total) !== 7000 || booking.currency !== "EUR") {
    throw new Error("Golden booking amount/currency is invalid for refund proof.");
  }

  const now = new Date().toISOString();
  const localRefundId = `re_test_klyx_local_${randomUUID().replaceAll("-", "")}`;

  const { data: promoted, error: promoteError } = await admin
    .from("bookings")
    .update({
      refund_status: "succeeded",
      stripe_refund_id: localRefundId,
      refunded_amount_cents: 7000,
      refunded_at: now,
      updated_at: now,
    })
    .eq("id", booking.id)
    .eq("payment_status", "paid")
    .select("id, payment_status, refund_status, refunded_amount_cents")
    .maybeSingle();

  if (promoteError) {
    throw new Error(`Unable to apply local full refund fixture: ${promoteError.message}`);
  }

  if (
    !promoted ||
    promoted.payment_status !== "refunded" ||
    promoted.refund_status !== "succeeded" ||
    Number(promoted.refunded_amount_cents) !== 7000
  ) {
    throw new Error("Full refund did not promote payment_status to refunded.");
  }

  const { data: latePaymentRows, error: latePaymentError } = await admin
    .from("bookings")
    .update({
      payment_status: "paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .select("id, payment_status");

  if (latePaymentError) {
    throw new Error(
      `Late payment mutation probe failed unexpectedly: ${latePaymentError.message}`
    );
  }

  if ((latePaymentRows ?? []).length !== 0) {
    throw new Error("A refunded booking accepted a late payment-state mutation.");
  }

  const { data: terminalBooking, error: terminalError } = await admin
    .from("bookings")
    .select("id, payment_status, refund_status, refunded_amount_cents")
    .eq("id", booking.id)
    .single();

  if (terminalError) {
    throw new Error(`Unable to reload terminal refund state: ${terminalError.message}`);
  }

  if (
    terminalBooking.payment_status !== "refunded" ||
    terminalBooking.refund_status !== "succeeded" ||
    Number(terminalBooking.refunded_amount_cents) !== 7000
  ) {
    throw new Error("Refunded booking did not remain terminal after late mutation probe.");
  }

  const overview = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/overview",
  });

  const card = (overview?.cards ?? []).find(
    (item) => item.entityType === "booking" && item.id === booking.id
  );

  if (
    !card ||
    card.status !== "refunded" ||
    card.statusLabel !== "Remboursee" ||
    card.paymentStatus !== "refunded" ||
    card.refundStatus !== "succeeded" ||
    card.actionRequired !== false ||
    card.history !== true
  ) {
    throw new Error(
      `Booking overview does not expose terminal refunded state: ${JSON.stringify(card)}`
    );
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      refundedTerminalStateVerified: true,
      bookingId: booking.id,
      paymentStatus: terminalBooking.payment_status,
      refundStatus: terminalBooking.refund_status,
      refundedAmountCents: Number(terminalBooking.refunded_amount_cents),
      latePaymentMutationBlocked: true,
      overviewStatus: card.status,
      realStripeNetworkUsed: false,
      ephemeralSupabaseOnly: true,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path refund terminal state failed: ${message}`);
  process.exitCode = 1;
});

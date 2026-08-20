import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method,
  body,
  expectedStatuses = [200],
}) {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON status ${response.status}.`
      );
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";

    throw new Error(
      `${method} ${path} returned ${response.status}: ${safeMessage}`
    );
  }

  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Stripe network proof is allowed only with ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Stripe network proof requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const stripeSecretKey = requiredGoldenPathEnv("STRIPE_SECRET_KEY");
  const stripePublishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  );

  if (
    !stripeSecretKey.startsWith("sk_test_") ||
    !stripePublishableKey.startsWith("pk_test_")
  ) {
    throw new Error("Stripe network proof requires test-mode Stripe keys only.");
  }

  if (
    process.env.KLYX_STRIPE_MODE !== "test" ||
    process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "false" ||
    process.env.KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS !== "true"
  ) {
    throw new Error("Stripe network proof runtime is not test-only.");
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the Stripe network proof account.");
  }

  const accessToken = signInData.session.access_token;
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to load Stripe network proof profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Stripe network proof client/provider profiles are missing.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, status, payment_status, service_status, amount_total, currency, stripe_checkout_session_id, payment_mode"
    )
    .eq("parent_id", client.id)
    .eq("provider_id", provider.id)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error(
      `Unable to locate accepted unpaid booking: ${
        bookingError?.message ?? "missing booking"
      }`
    );
  }

  if (
    booking.service_status !== "scheduled" ||
    Number(booking.amount_total) !== 7000 ||
    booking.currency !== "EUR" ||
    booking.stripe_checkout_session_id !== null
  ) {
    throw new Error("Booking is not ready for the Stripe network proof.");
  }

  const stripe = new Stripe(stripeSecretKey);
  let remoteSession = null;

  try {
    const checkout = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/stripe/create-checkout-session",
      method: "POST",
      body: { bookingId: booking.id },
    });

    if (
      checkout?.reused !== false ||
      checkout?.paymentMode !== "platform_test_only" ||
      Number(checkout?.amountTotal) !== 7000 ||
      typeof checkout?.url !== "string"
    ) {
      throw new Error("KLYX did not create the expected Stripe test Checkout.");
    }

    const checkoutUrl = new URL(checkout.url);
    if (
      checkoutUrl.protocol !== "https:" ||
      !checkoutUrl.hostname.endsWith("stripe.com")
    ) {
      throw new Error("Stripe Checkout URL is not hosted by Stripe HTTPS.");
    }

    const { data: checkoutBooking, error: checkoutBookingError } = await admin
      .from("bookings")
      .select(
        "id, payment_status, payment_mode, stripe_checkout_session_id, amount_total, currency"
      )
      .eq("id", booking.id)
      .single();

    if (checkoutBookingError) {
      throw new Error(
        `Unable to verify checkout booking: ${checkoutBookingError.message}`
      );
    }

    if (
      checkoutBooking.payment_status !== "checkout_created" ||
      checkoutBooking.payment_mode !== "platform_test_only" ||
      typeof checkoutBooking.stripe_checkout_session_id !== "string" ||
      !checkoutBooking.stripe_checkout_session_id.startsWith("cs_test_") ||
      Number(checkoutBooking.amount_total) !== 7000 ||
      checkoutBooking.currency !== "EUR"
    ) {
      throw new Error("KLYX did not persist the expected Checkout state.");
    }

    remoteSession = await stripe.checkout.sessions.retrieve(
      checkoutBooking.stripe_checkout_session_id
    );

    if (
      remoteSession.livemode !== false ||
      remoteSession.mode !== "payment" ||
      remoteSession.status !== "open" ||
      remoteSession.payment_status !== "unpaid" ||
      Number(remoteSession.amount_total) !== 7000 ||
      remoteSession.currency !== "eur" ||
      remoteSession.metadata?.booking_id !== booking.id ||
      remoteSession.metadata?.provider_id !== provider.id ||
      remoteSession.metadata?.payment_mode !== "platform_test_only"
    ) {
      throw new Error("Remote Stripe Checkout Session does not match KLYX state.");
    }

    const reusedCheckout = await requestJson({
      appOrigin,
      accessToken,
      profileId: client.id,
      path: "/api/stripe/create-checkout-session",
      method: "POST",
      body: { bookingId: booking.id },
    });

    if (
      reusedCheckout?.reused !== true ||
      reusedCheckout?.paymentMode !== "platform_test_only" ||
      Number(reusedCheckout?.amountTotal) !== 7000 ||
      reusedCheckout?.url !== checkout.url
    ) {
      throw new Error("KLYX did not reuse the existing open Checkout Session.");
    }

    const { data: afterReuse, error: afterReuseError } = await admin
      .from("bookings")
      .select("stripe_checkout_session_id, payment_status")
      .eq("id", booking.id)
      .single();

    if (afterReuseError) {
      throw new Error(
        `Unable to verify Checkout reuse state: ${afterReuseError.message}`
      );
    }

    if (
      afterReuse.stripe_checkout_session_id !== remoteSession.id ||
      afterReuse.payment_status !== "checkout_created"
    ) {
      throw new Error("Checkout reuse changed the persisted Stripe session.");
    }

    fs.mkdirSync("stripe-network-proof", { recursive: true });
    fs.writeFileSync(
      "stripe-network-proof/proof.json",
      `${JSON.stringify(
        {
          verified: true,
          livemode: false,
          mode: remoteSession.mode,
          status: remoteSession.status,
          paymentStatus: remoteSession.payment_status,
          amountTotal: remoteSession.amount_total,
          currency: remoteSession.currency,
          paymentMode: checkoutBooking.payment_mode,
          reused: true,
          verifiedAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } finally {
    if (remoteSession?.id) {
      try {
        const latest = await stripe.checkout.sessions.retrieve(remoteSession.id);
        if (latest.status === "open") {
          await stripe.checkout.sessions.expire(remoteSession.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to expire Stripe test Checkout: ${message}`);
        process.exitCode = 1;
      }
    }

    await userClient.auth.signOut();
  }

  if (process.exitCode) return;

  process.stdout.write(
    `${JSON.stringify({
      verified: true,
      stripeNetwork: true,
      livemode: false,
      paymentMode: "platform_test_only",
      amountTotal: 7000,
      currency: "EUR",
      checkoutReused: true,
      sessionExpiredAfterProof: true,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Stripe network Checkout proof failed: ${message}`);
  process.exitCode = 1;
});

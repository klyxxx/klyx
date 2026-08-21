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

function assertStripeHostedUrl(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} is missing.`);
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    !(url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
  ) {
    throw new Error(`${label} is not a Stripe HTTPS URL.`);
  }
}

async function providerConnectState(admin, providerId) {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, owner_user_id, account_type, country_code, currency_code, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
    )
    .eq("id", providerId)
    .single();

  if (error || !data) {
    throw new Error(
      `Unable to load provider Connect state: ${error?.message ?? "missing profile"}`
    );
  }

  return data;
}

async function resetProviderConnectState(admin, providerId) {
  const { error } = await admin
    .from("profiles")
    .update({
      stripe_account_id: null,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId);

  if (error) {
    throw new Error(`Unable to reset provider Connect state: ${error.message}`);
  }
}

async function discoverProofAccounts(stripe, providerId) {
  const accounts = await stripe.accounts.list({ limit: 100 });

  return accounts.data.filter(
    (account) => account.metadata?.klyx_profile_id === providerId
  );
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Stripe Connect network proof is allowed only with ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Stripe Connect network proof requires the isolated local KLYX server on 127.0.0.1:3100."
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
    throw new Error(
      "Stripe Connect network proof requires Stripe test-mode keys only."
    );
  }

  if (
    process.env.KLYX_STRIPE_MODE !== "test" ||
    process.env.KLYX_LIVE_PAYMENTS_ENABLED !== "false"
  ) {
    throw new Error("Stripe Connect network proof runtime is not test-only.");
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
  const stripe = new Stripe(stripeSecretKey);

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error(
      "Unable to authenticate the Stripe Connect network proof account."
    );
  }

  const accessToken = signInData.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type, country_code, currency_code")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to load Stripe Connect proof profiles: ${profilesError.message}`
    );
  }

  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!provider) {
    throw new Error("Stripe Connect proof provider profile is missing.");
  }

  if (provider.country_code !== "BE" || provider.currency_code !== "EUR") {
    throw new Error("Stripe Connect proof provider must use the BE/EUR market.");
  }

  let accountId = null;
  let accountCreated = false;
  let accountReused = false;
  let remoteAccountVerified = false;
  let statusVerified = false;
  let deletedAccountIds = [];
  let cleanupFailure = null;

  try {
    await resetProviderConnectState(admin, provider.id);

    const before = await providerConnectState(admin, provider.id);
    if (
      before.stripe_account_id !== null ||
      before.stripe_onboarding_complete !== false ||
      before.stripe_charges_enabled !== false ||
      before.stripe_payouts_enabled !== false
    ) {
      throw new Error("Provider Connect state did not reset before proof.");
    }

    const firstCreate = await requestJson({
      appOrigin,
      accessToken,
      profileId: provider.id,
      path: "/api/stripe/connect/create-account",
      method: "POST",
    });

    assertStripeHostedUrl(firstCreate?.url, "First Stripe Connect onboarding URL");

    const afterFirstCreate = await providerConnectState(admin, provider.id);
    accountId = afterFirstCreate.stripe_account_id;

    if (
      typeof accountId !== "string" ||
      !accountId.startsWith("acct_") ||
      afterFirstCreate.stripe_onboarding_complete !== false ||
      afterFirstCreate.stripe_charges_enabled !== false ||
      afterFirstCreate.stripe_payouts_enabled !== false
    ) {
      throw new Error("KLYX did not persist the expected new Connect account state.");
    }

    accountCreated = true;

    const remoteAccount = await stripe.accounts.retrieve(accountId);

    if (
      remoteAccount.id !== accountId ||
      remoteAccount.type !== "express" ||
      remoteAccount.country !== "BE" ||
      remoteAccount.details_submitted !== false ||
      remoteAccount.charges_enabled !== false ||
      remoteAccount.payouts_enabled !== false ||
      remoteAccount.metadata?.klyx_profile_id !== provider.id ||
      remoteAccount.metadata?.klyx_owner_user_id !== signInData.user.id
    ) {
      throw new Error("Remote Stripe TEST Connect account does not match KLYX state.");
    }

    remoteAccountVerified = true;

    const secondCreate = await requestJson({
      appOrigin,
      accessToken,
      profileId: provider.id,
      path: "/api/stripe/connect/create-account",
      method: "POST",
    });

    assertStripeHostedUrl(secondCreate?.url, "Reused Stripe Connect onboarding URL");

    const afterSecondCreate = await providerConnectState(admin, provider.id);
    if (afterSecondCreate.stripe_account_id !== accountId) {
      throw new Error("KLYX created a second Connect account instead of reusing it.");
    }

    const matchingAccounts = await discoverProofAccounts(stripe, provider.id);
    if (
      matchingAccounts.length !== 1 ||
      matchingAccounts[0]?.id !== accountId
    ) {
      throw new Error(
        `Expected exactly one remote Connect account for the proof profile, found ${matchingAccounts.length}.`
      );
    }

    accountReused = true;

    const status = await requestJson({
      appOrigin,
      accessToken,
      profileId: provider.id,
      path: "/api/stripe/connect/status",
      method: "GET",
    });

    if (
      status?.connected !== true ||
      status?.accountId !== accountId ||
      status?.onboardingComplete !== false ||
      status?.chargesEnabled !== false ||
      status?.payoutsEnabled !== false
    ) {
      throw new Error(
        `KLYX Stripe Connect status is unexpected: ${JSON.stringify({
          connected: status?.connected,
          onboardingComplete: status?.onboardingComplete,
          chargesEnabled: status?.chargesEnabled,
          payoutsEnabled: status?.payoutsEnabled,
        })}`
      );
    }

    const afterStatus = await providerConnectState(admin, provider.id);
    if (
      afterStatus.stripe_account_id !== accountId ||
      afterStatus.stripe_onboarding_complete !== false ||
      afterStatus.stripe_charges_enabled !== false ||
      afterStatus.stripe_payouts_enabled !== false
    ) {
      throw new Error("KLYX did not persist the remote Connect status faithfully.");
    }

    statusVerified = true;
  } finally {
    try {
      const candidateIds = new Set();

      if (typeof accountId === "string" && accountId.startsWith("acct_")) {
        candidateIds.add(accountId);
      }

      const discovered = await discoverProofAccounts(stripe, provider.id);
      for (const account of discovered) {
        candidateIds.add(account.id);
      }

      for (const candidateId of candidateIds) {
        const deleted = await stripe.accounts.del(candidateId);
        if (deleted.deleted !== true) {
          throw new Error(`Stripe did not confirm deletion for ${candidateId}.`);
        }
        deletedAccountIds.push(candidateId);
      }

      await resetProviderConnectState(admin, provider.id);

      const afterCleanup = await providerConnectState(admin, provider.id);
      if (
        afterCleanup.stripe_account_id !== null ||
        afterCleanup.stripe_onboarding_complete !== false ||
        afterCleanup.stripe_charges_enabled !== false ||
        afterCleanup.stripe_payouts_enabled !== false
      ) {
        throw new Error("Provider Connect state is not clean after proof.");
      }
    } catch (error) {
      cleanupFailure = error instanceof Error ? error.message : String(error);
    }

    await userClient.auth.signOut();
  }

  if (cleanupFailure) {
    throw new Error(`Stripe Connect proof cleanup failed: ${cleanupFailure}`);
  }

  if (
    !accountCreated ||
    !accountReused ||
    !remoteAccountVerified ||
    !statusVerified ||
    !accountId ||
    !deletedAccountIds.includes(accountId)
  ) {
    throw new Error("Stripe Connect network proof did not complete all invariants.");
  }

  fs.mkdirSync("stripe-network-proof", { recursive: true });
  fs.writeFileSync(
    "stripe-network-proof/connect-proof.json",
    `${JSON.stringify(
      {
        verified: true,
        stripeConnectNetwork: true,
        testMode: true,
        accountType: "express",
        country: "BE",
        accountCreated: true,
        accountReused: true,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountDeletedAfterProof: true,
        localStateResetAfterProof: true,
        payoutClaimed: false,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  process.stdout.write(
    `${JSON.stringify({
      verified: true,
      stripeConnectNetwork: true,
      testMode: true,
      accountType: "express",
      country: "BE",
      accountCreated: true,
      accountReused: true,
      statusVerified: true,
      accountDeletedAfterProof: true,
      payoutClaimed: false,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Stripe Connect network proof failed: ${message}`);
  process.exitCode = 1;
});

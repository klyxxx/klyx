import { NextResponse } from "next/server";

import Stripe from "stripe";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { assessKlyxStripeMarketAccess } from "@/lib/klyx-stripe-market-access";
import {
  assessStripeConnectCountry,
  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
} from "@/lib/stripe-connect-country";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStripeRuntimeMode } from "@/lib/stripe-runtime";

// KLYX_SPLIT_STRIPE_READINESS_API_13_25

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type JsonRow = Record<string, unknown>;

type BatchRow = {
  id: string;
  client_profile_id: string;
  status: string;
  expected_booking_count: number;
  created_booking_count: number;
};

type BatchItemRow = {
  booking_id: string;
  slot_id: string;
  provider_profile_id: string;
};

type PriceConfirmationRow = {
  id: string;
  price_snapshot: unknown;
  item_count: number;
  total_amount_cents: number;
  currency: string;
};

type SnapshotItem = {
  bookingId: string;
  slotId: string;
  providerId: string;
  amountCents: number;
  currency: string;
};

type ProviderStripeState =
  | "ready"
  | "missing_profile"
  | "market_not_ready"
  | "missing_account"
  | "restricted"
  | "lookup_failed";

function asRecord(value: unknown): JsonRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRow;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function profileName(profile: JsonRow | undefined): string {
  if (!profile) {
    return "Prestataire KLYX";
  }

  const firstName = text(profile.first_name);
  const lastName = text(profile.last_name);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return name || "Prestataire KLYX";
}

function stripeAccountId(profile: JsonRow | undefined): string | null {
  if (!profile) {
    return null;
  }

  const candidateKeys = [
    "stripe_account_id",
    "stripe_connect_account_id",
    "connect_account_id",
    "stripeAccountId",
    "stripeConnectAccountId",
  ];

  for (const key of candidateKeys) {
    const value = text(profile[key]);
    if (value.startsWith("acct_")) {
      return value;
    }
  }

  return null;
}

function maskedStripeAccount(accountId: string): string {
  if (accountId.length <= 8) {
    return "Compte Stripe";
  }

  return "••••" + accountId.slice(-4);
}

function parseSnapshot(value: unknown): SnapshotItem[] {
  const snapshot = asRecord(value);
  if (!snapshot || !Array.isArray(snapshot.items)) {
    return [];
  }

  const result: SnapshotItem[] = [];

  for (const rawItem of snapshot.items) {
    const item = asRecord(rawItem);
    if (!item) {
      continue;
    }

    const bookingId = text(item.bookingId);
    const slotId = text(item.slotId);
    const providerId = text(item.providerId);
    const amountCents = numberValue(item.amountCents);
    const currency = text(item.currency).toUpperCase();

    if (
      !bookingId ||
      !slotId ||
      !providerId ||
      amountCents === null ||
      amountCents < 0 ||
      currency.length !== 3
    ) {
      continue;
    }

    result.push({
      bookingId,
      slotId,
      providerId,
      amountCents: Math.round(amountCents),
      currency,
    });
  }

  return result;
}

function blockedProviderState(
  providerBase: {
    providerId: string;
    providerName: string;
    marketCountryCode: string;
    marketReady: boolean;
    marketReason: string;
    marketBlockers: string[];
  },
  state: ProviderStripeState,
  account: string | null,
  readinessBlockReason: string
) {
  return {
    ...providerBase,
    state,
    account,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirementsDue: 0,
    readinessBlockReason,
    ready: false,
  };
}

export async function GET(request: Request, context: RouteContext) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: batchId } = await context.params;

    const { data: batchData, error: batchError } = await supabaseAdmin
      .from("split_booking_batches")
      .select(
        "id, client_profile_id, status, expected_booking_count, created_booking_count"
      )
      .eq("id", batchId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (batchError) {
      throw new Error(batchError.message);
    }

    const batch = batchData as unknown as BatchRow | null;
    if (!batch) {
      return NextResponse.json(
        { error: "Mission multi-prestataires introuvable." },
        { status: 404 }
      );
    }

    const [itemsResult, priceResult] = await Promise.all([
      supabaseAdmin
        .from("split_booking_batch_items")
        .select("booking_id, slot_id, provider_profile_id")
        .eq("batch_id", batch.id),
      supabaseAdmin
        .from("split_booking_price_confirmations")
        .select(
          "id, price_snapshot, item_count, total_amount_cents, currency"
        )
        .eq("batch_id", batch.id)
        .is("invalidated_at", null)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (itemsResult.error) {
      throw new Error(itemsResult.error.message);
    }

    if (priceResult.error) {
      throw new Error(priceResult.error.message);
    }

    const batchItems = (itemsResult.data ?? []) as unknown as BatchItemRow[];
    const priceConfirmation = priceResult.data as unknown as
      | PriceConfirmationRow
      | null;

    if (!priceConfirmation) {
      return NextResponse.json({
        batchId: batch.id,
        stripeReadinessComplete: false,
        allProvidersStripeReady: false,
        blockReason: "PRICE_CONFIRMATION_REQUIRED",
        providers: [],
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
        paymentCreated: false,
        checkoutCreated: false,
        transferCreated: false,
      });
    }

    const snapshotItems = parseSnapshot(priceConfirmation.price_snapshot);
    const expectedCount = Number(batch.expected_booking_count);
    const itemKeySet = new Set(
      batchItems.map(
        (item) =>
          item.booking_id +
          ":" +
          item.slot_id +
          ":" +
          item.provider_profile_id
      )
    );
    const snapshotMatchesBatch = snapshotItems.every((item) =>
      itemKeySet.has(item.bookingId + ":" + item.slotId + ":" + item.providerId)
    );
    const structureValid =
      batch.status === "created" &&
      Number(batch.created_booking_count) === expectedCount &&
      batchItems.length === expectedCount &&
      snapshotItems.length === expectedCount &&
      Number(priceConfirmation.item_count) === expectedCount &&
      snapshotMatchesBatch;

    if (!structureValid) {
      return NextResponse.json({
        batchId: batch.id,
        stripeReadinessComplete: false,
        allProvidersStripeReady: false,
        blockReason: "PAYMENT_PLAN_REVALIDATION_REQUIRED",
        providers: [],
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
        paymentCreated: false,
        checkoutCreated: false,
        transferCreated: false,
      });
    }

    const stripeMode = getStripeRuntimeMode();
    const clientMarketAccess = assessKlyxStripeMarketAccess(
      profile.countryCode,
      stripeMode
    );

    const providerIds = Array.from(
      new Set(snapshotItems.map((item) => item.providerId))
    );

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("id", providerIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const profiles = (profileData ?? []) as unknown as JsonRow[];
    const profileById = new Map<string, JsonRow>();

    for (const providerProfile of profiles) {
      const id = text(providerProfile.id);
      if (id) {
        profileById.set(id, providerProfile);
      }
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return NextResponse.json({
        batchId: batch.id,
        stripeReadinessComplete: false,
        allProvidersStripeReady: false,
        clientMarketReady: clientMarketAccess.allowed,
        clientMarketCountryCode: clientMarketAccess.countryCode,
        clientMarketReason: clientMarketAccess.reason,
        clientMarketBlockers: clientMarketAccess.blockers,
        blockReason: "STRIPE_SERVER_CONFIGURATION_REQUIRED",
        providers: [],
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
        paymentCreated: false,
        checkoutCreated: false,
        transferCreated: false,
      });
    }

    const stripe = new Stripe(stripeSecret);

    const providers = await Promise.all(
      providerIds.map(async (providerId) => {
        const providerProfile = profileById.get(providerId);

        if (!providerProfile) {
          return blockedProviderState(
            {
              providerId,
              providerName: profileName(providerProfile),
              marketCountryCode: "",
              marketReady: false,
              marketReason: "provider_profile_missing",
              marketBlockers: ["provider_profile"],
            },
            "missing_profile",
            null,
            "PROVIDER_PROFILE_MISSING"
          );
        }

        const providerMarketAccess = assessKlyxStripeMarketAccess(
          text(providerProfile.country_code),
          stripeMode
        );
        const providerBase = {
          providerId,
          providerName: profileName(providerProfile),
          marketCountryCode: providerMarketAccess.countryCode,
          marketReady: providerMarketAccess.allowed,
          marketReason: providerMarketAccess.reason,
          marketBlockers: providerMarketAccess.blockers,
        };

        if (!providerMarketAccess.allowed) {
          return blockedProviderState(
            providerBase,
            "market_not_ready",
            null,
            "PROVIDER_MARKET_NOT_READY"
          );
        }

        const accountId = stripeAccountId(providerProfile);
        if (!accountId) {
          return blockedProviderState(
            providerBase,
            "missing_account",
            null,
            "PROVIDER_STRIPE_ACCOUNT_REQUIRED"
          );
        }

        try {
          const account = await stripe.accounts.retrieve(accountId);
          const deletedAccount =
            (account as unknown as { deleted?: boolean }).deleted === true;

          if (deletedAccount) {
            return blockedProviderState(
              providerBase,
              "restricted",
              maskedStripeAccount(accountId),
              "PROVIDER_STRIPE_NOT_READY"
            );
          }

          const countryAssessment = assessStripeConnectCountry({
            klyxCountryCode: text(providerProfile.country_code),
            stripeCountryCode: account.country,
          });

          if (!countryAssessment.matches) {
            return blockedProviderState(
              {
                ...providerBase,
                marketReady: false,
                marketBlockers: [
                  ...providerBase.marketBlockers,
                  STRIPE_ACCOUNT_COUNTRY_MISMATCH,
                ],
              },
              "restricted",
              maskedStripeAccount(accountId),
              STRIPE_ACCOUNT_COUNTRY_MISMATCH
            );
          }

          const requirementsDue = account.requirements?.currently_due?.length ?? 0;
          const chargesEnabled = account.charges_enabled === true;
          const payoutsEnabled = account.payouts_enabled === true;
          const detailsSubmitted = account.details_submitted === true;
          const ready =
            chargesEnabled &&
            payoutsEnabled &&
            detailsSubmitted &&
            requirementsDue === 0;

          return {
            ...providerBase,
            state: (ready ? "ready" : "restricted") as ProviderStripeState,
            account: maskedStripeAccount(accountId),
            chargesEnabled,
            payoutsEnabled,
            detailsSubmitted,
            requirementsDue,
            readinessBlockReason: ready ? null : "PROVIDER_STRIPE_NOT_READY",
            ready,
          };
        } catch {
          return blockedProviderState(
            providerBase,
            "lookup_failed",
            maskedStripeAccount(accountId),
            "PROVIDER_STRIPE_LOOKUP_FAILED"
          );
        }
      })
    );

    const readyProviders = providers.filter((provider) => provider.ready).length;
    const allProvidersStripeReady =
      providers.length >= 2 && readyProviders === providers.length;
    const providerMarketBlocked = providers.some(
      (provider) => provider.state === "market_not_ready"
    );
    const providerCountryMismatch = providers.some(
      (provider) =>
        provider.readinessBlockReason === STRIPE_ACCOUNT_COUNTRY_MISMATCH
    );
    const checkoutReady = clientMarketAccess.allowed && allProvidersStripeReady;

    let blockReason: string | null = null;

    if (providers.length < 2) {
      blockReason = "MULTI_PROVIDER_REQUIRED";
    } else if (!clientMarketAccess.allowed) {
      blockReason = "CLIENT_MARKET_NOT_READY";
    } else if (providerMarketBlocked) {
      blockReason = "PROVIDER_MARKET_NOT_READY";
    } else if (providerCountryMismatch) {
      blockReason = STRIPE_ACCOUNT_COUNTRY_MISMATCH;
    } else if (!allProvidersStripeReady) {
      blockReason = "PROVIDER_STRIPE_NOT_READY";
    }

    return NextResponse.json({
      batchId: batch.id,
      priceConfirmationId: priceConfirmation.id,
      stripeReadinessComplete: true,
      allProvidersStripeReady,
      paymentInfrastructureReady: checkoutReady,
      checkoutReady,
      clientMarketReady: clientMarketAccess.allowed,
      clientMarketCountryCode: clientMarketAccess.countryCode,
      clientMarketReason: clientMarketAccess.reason,
      clientMarketBlockers: clientMarketAccess.blockers,
      blockReason,
      providerCount: providers.length,
      readyProviderCount: readyProviders,
      providers,
      strategy: "separate_provider_payments",
      oneDestinationPerPaymentUnit: true,
      stripeAccountsCheckedLive: true,
      explicitPaymentConfirmationRequired: true,
      automaticProviderOnboarding: false,
      automaticPayment: false,
      paymentCreated: false,
      checkoutCreated: false,
      transferCreated: false,
    });
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "split_stripe_readiness_failed",
      route: "/api/bookings/split-missions/[id]/stripe-readiness",
      method: "GET",
      status: 500,
      code: "split_stripe_readiness_failed",
      startedAt,
      details: {
        stripeReadinessComplete: false,
        allProvidersStripeReady: false,
        explicitPaymentConfirmationRequired: true,
        automaticPayment: false,
        paymentCreated: false,
        checkoutCreated: false,
        transferCreated: false,
      },
    });
  }
}

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  secureApiErrorResponse,
} from "@/lib/api-error";

import {
  calculateKlyxEconomics,
  getKlyxCommissionPercent,
} from "@/lib/klyx-economics";

import {
  assessKlyxStripeMarketAccess,
} from "@/lib/klyx-stripe-market-access";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

import {
  assertStripeRuntimeReady,
} from "@/lib/stripe-runtime";

// KLYX_SPLIT_CHECKOUT_API_13_27

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

type JsonRow =
  Record<string, unknown>;

type RunRow = {
  id:
    string;

  batch_id:
    string;

  client_profile_id:
    string;

  payment_confirmation_id:
    string;

  payment_plan_hash:
    string;

  total_amount_cents:
    number;

  currency:
    string;

  provider_count:
    number;

  payment_unit_count:
    number;

  status:
    string;
};

type ConfirmationRow = {
  id:
    string;

  batch_id:
    string;

  client_profile_id:
    string;

  price_confirmation_id:
    string;

  payment_plan_hash:
    string;

  payment_plan_snapshot:
    unknown;

  provider_count:
    number;

  payment_unit_count:
    number;

  total_amount_cents:
    number;

  currency:
    string;

  invalidated_at:
    string | null;

  consumed_at:
    string | null;
};

type PriceProofRow = {
  id:
    string;

  batch_id:
    string;

  price_snapshot:
    unknown;

  invalidated_at:
    string | null;
};

type PriceItem = {
  bookingId:
    string;

  slotId:
    string;

  providerId:
    string;

  amountCents:
    number;

  currency:
    string;
};

type PaymentUnitPlan = {
  providerId:
    string;

  amountCents:
    number;

  currency:
    string;

  bookingIds:
    string[];

  slotIds:
    string[];

  stripeAccountId:
    string;
};

type PaymentPlan = {
  batchId:
    string;

  priceConfirmationId:
    string;

  providerCount:
    number;

  paymentUnitCount:
    number;

  totalAmountCents:
    number;

  currency:
    string;

  units:
    PaymentUnitPlan[];
};

type UnitRow = {
  id:
    string;

  run_id:
    string;

  provider_profile_id:
    string;

  stripe_account_id:
    string;

  amount_cents:
    number;

  currency:
    string;

  booking_ids:
    unknown;

  slot_ids:
    unknown;

  status:
    string;

  attempt_number:
    number;

  stripe_checkout_session_id:
    string | null;

  checkout_url:
    string | null;
};

type ClaimRow = {
  action:
    "create" |
    "reuse" |
    "busy" |
    "paid";

  unit_id:
    string;

  checkout_session_id:
    string | null;

  attempt_number:
    number;
};

function asRecord(
  value:
    unknown
): JsonRow | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    JsonRow;
}

function text(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function numeric(
  value:
    unknown
): number | null {
  const result =
    Number(
      value
    );

  return Number.isFinite(
    result
  )
    ? result
    : null;
}

function stringArray(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item ===
        "string" &&
      Boolean(
        item.trim()
      )
  );
}

function parsePriceItems(
  value:
    unknown
): PriceItem[] {
  const root =
    asRecord(
      value
    );

  if (
    !root ||
    !Array.isArray(
      root.items
    )
  ) {
    return [];
  }

  const result:
    PriceItem[] =
    [];

  for (
    const raw
    of root.items
  ) {
    const item =
      asRecord(
        raw
      );

    if (!item) {
      continue;
    }

    const bookingId =
      text(
        item.bookingId
      );

    const slotId =
      text(
        item.slotId
      );

    const providerId =
      text(
        item.providerId
      );

    const amount =
      numeric(
        item.amountCents
      );

    const currency =
      text(
        item.currency
      )
        .toUpperCase();

    if (
      !bookingId ||
      !slotId ||
      !providerId ||
      amount ===
        null ||
      amount <
        0 ||
      currency.length !==
        3
    ) {
      continue;
    }

    result.push({
      bookingId,

      slotId,

      providerId,

      amountCents:
        Math.round(
          amount
        ),

      currency,
    });
  }

  return result;
}

function parsePaymentPlan(
  value:
    unknown
): PaymentPlan | null {
  const root =
    asRecord(
      value
    );

  if (
    !root ||
    !Array.isArray(
      root.units
    )
  ) {
    return null;
  }

  const batchId =
    text(
      root.batchId
    );

  const priceConfirmationId =
    text(
      root.priceConfirmationId
    );

  const providerCount =
    numeric(
      root.providerCount
    );

  const paymentUnitCount =
    numeric(
      root.paymentUnitCount
    );

  const totalAmountCents =
    numeric(
      root.totalAmountCents
    );

  const currency =
    text(
      root.currency
    )
      .toUpperCase();

  if (
    !batchId ||
    !priceConfirmationId ||
    providerCount ===
      null ||
    paymentUnitCount ===
      null ||
    totalAmountCents ===
      null ||
    currency.length !==
      3
  ) {
    return null;
  }

  const units:
    PaymentUnitPlan[] =
    [];

  for (
    const raw
    of root.units
  ) {
    const unit =
      asRecord(
        raw
      );

    if (!unit) {
      continue;
    }

    const providerId =
      text(
        unit.providerId
      );

    const amountCents =
      numeric(
        unit.amountCents
      );

    const unitCurrency =
      text(
        unit.currency
      )
        .toUpperCase();

    const stripeAccountId =
      text(
        unit.stripeAccountId
      );

    const bookingIds =
      stringArray(
        unit.bookingIds
      )
        .sort();

    const slotIds =
      stringArray(
        unit.slotIds
      )
        .sort();

    if (
      !providerId ||
      amountCents ===
        null ||
      amountCents <
        50 ||
      unitCurrency.length !==
        3 ||
      !stripeAccountId.startsWith(
        "acct_"
      ) ||
      bookingIds.length ===
        0 ||
      slotIds.length !==
        bookingIds.length
    ) {
      return null;
    }

    units.push({
      providerId,

      amountCents:
        Math.round(
          amountCents
        ),

      currency:
        unitCurrency,

      bookingIds,

      slotIds,

      stripeAccountId,
    });
  }

  units.sort(
    (
      first,
      second
    ) =>
      first.providerId.localeCompare(
        second.providerId
      )
  );

  return {
    batchId,

    priceConfirmationId,

    providerCount:
      Math.round(
        providerCount
      ),

    paymentUnitCount:
      Math.round(
        paymentUnitCount
      ),

    totalAmountCents:
      Math.round(
        totalAmountCents
      ),

    currency,

    units,
  };
}

function hashPlan(
  plan:
    PaymentPlan
): string {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        plan
      )
    )
    .digest(
      "hex"
    );
}

function bookingAmount(
  booking:
    JsonRow
): number | null {
  const estimated =
    numeric(
      booking.estimated_amount_cents
    );

  if (
    estimated !==
      null &&
    estimated >=
      0
  ) {
    return Math.round(
      estimated
    );
  }

  const total =
    numeric(
      booking.amount_total
    );

  if (
    total !==
      null &&
    total >=
      0
  ) {
    return Math.round(
      total
    );
  }

  return null;
}

function bookingAccepted(
  booking:
    JsonRow
): boolean {
  const status =
    text(
      booking.status
    )
      .toLowerCase();

  const serviceStatus =
    text(
      booking.service_status
    )
      .toLowerCase();

  return (
    [
      "accepted",
      "confirmed",
      "completed",
    ].includes(
      status
    ) ||
    [
      "started",
      "arrived",
      "ongoing",
      "in_progress",
      "completed",
    ].includes(
      serviceStatus
    )
  );
}

function paymentAlreadyClaimed(
  booking:
    JsonRow
): boolean {
  const paymentStatus =
    text(
      booking.payment_status
    )
      .toLowerCase();

  return [
    "paid",
    "checkout_created",
    "processing",
    "pending",
  ].includes(
    paymentStatus
  );
}

function stripeAccountFromProfile(
  profile:
    JsonRow
): string {
  const possible =
    [
      "stripe_account_id",
      "stripe_connect_account_id",
      "connect_account_id",
    ];

  for (
    const key
    of possible
  ) {
    const value =
      text(
        profile[key]
      );

    if (
      value.startsWith(
        "acct_"
      )
    ) {
      return value;
    }
  }

  return "";
}

async function getExistingRun(
  batchId:
    string
): Promise<RunRow | null> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_runs"
      )
      .select(
        "id, batch_id, client_profile_id, payment_confirmation_id, payment_plan_hash, total_amount_cents, currency, provider_count, payment_unit_count, status"
      )
      .eq(
        "batch_id",
        batchId
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return data as unknown as
    RunRow |
    null;
}

async function getUnits(
  runId:
    string
): Promise<UnitRow[]> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "split_booking_payment_units"
      )
      .select(
        "id, run_id, provider_profile_id, stripe_account_id, amount_cents, currency, booking_ids, slot_ids, status, attempt_number, stripe_checkout_session_id, checkout_url"
      )
      .eq(
        "run_id",
        runId
      )
      .order(
        "created_at",
        {
          ascending:
            true,
        }
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  return (
    data ??
    []
  ) as unknown as
    UnitRow[];
}

function publicUnits(
  units:
    UnitRow[]
) {
  return units.map(
    (
      unit
    ) => ({
      id:
        unit.id,

      providerId:
        unit.provider_profile_id,

      amountCents:
        Number(
          unit.amount_cents
        ),

      currency:
        unit.currency,

      bookingCount:
        stringArray(
          unit.booking_ids
        ).length,

      status:
        unit.status,

      checkoutUrl:
        unit.status ===
          "checkout_open"
          ? unit.checkout_url
          : null,

      paid:
        unit.status ===
          "paid",
    })
  );
}

export async function GET(
  request:
    Request,

  context:
    RouteContext
) {
  const startedAt =
    Date.now();

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const {
      id:
        batchId,
    } =
      await context.params;

    const run =
      await getExistingRun(
        batchId
      );

    if (!run) {
      return NextResponse.json({
        prepared:
          false,

        status:
          "not_started",

        units:
          [],

        automaticPayment:
          false,

        moneyMovedAutomatically:
          false,
      });
    }

    if (
      run.client_profile_id !==
      profile.id
    ) {
      return NextResponse.json(
        {
          error:
            "Accès refusé.",
        },
        {
          status:
            403,
        }
      );
    }

    const units =
      await getUnits(
        run.id
      );

    return NextResponse.json({
      prepared:
        true,

      runId:
        run.id,

      status:
        run.status,

      totalAmountCents:
        Number(
          run.total_amount_cents
        ),

      currency:
        run.currency,

      paymentUnitCount:
        run.payment_unit_count,

      paidUnitCount:
        units.filter(
          (
            unit
          ) =>
            unit.status ===
            "paid"
        ).length,

      units:
        publicUnits(
          units
        ),

      automaticPayment:
        false,

      moneyMovedAutomatically:
        false,
    });
  }
  catch (
    error
  ) {
    return secureApiErrorResponse({
      error,
      event:
        "split_checkout_read_failed",
      route:
        "/api/bookings/split-missions/[id]/checkout",
      method: "GET",
      code:
        "split_checkout_read_failed",
      status: 500,
      startedAt,
    });
  }
}


export async function POST(
  request:
    Request,

  context:
    RouteContext
) {
  const startedAt =
    Date.now();

  try {
    const stripeRuntime =
      assertStripeRuntimeReady();

    const {
      user,
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const body =
      asRecord(
        await request.json()
      );

    if (
      !body ||
      body.checkoutPreparationConfirmed !==
        true
    ) {
      return NextResponse.json(
        {
          error:
            "Préparation explicite du paiement requise.",

          code:
            "SPLIT_CHECKOUT_PREPARATION_CONFIRMATION_REQUIRED",

          automaticPayment:
            false,
        },
        {
          status:
            400,
        }
      );
    }

    const clientMarketAccess =
      assessKlyxStripeMarketAccess(
        profile.countryCode,
        stripeRuntime.mode
      );

    if (
      !clientMarketAccess.allowed
    ) {
      return NextResponse.json(
        {
          error:
            "KLYX n'est pas encore ouvert aux paiements réels dans le pays de ce profil client.",

          code:
            "SPLIT_CHECKOUT_MARKET_NOT_READY",

          participant:
            "client",

          countryCode:
            clientMarketAccess.countryCode,

          blockers:
            clientMarketAccess.blockers,
        },
        {
          status:
            409,
        }
      );
    }

    const {
      id:
        batchId,
    } =
      await context.params;

    let run =
      await getExistingRun(
        batchId
      );

    let confirmation:
      ConfirmationRow |
      null =
      null;

    if (run) {
      if (
        run.client_profile_id !==
        profile.id
      ) {
        return NextResponse.json(
          {
            error:
              "Accès refusé.",
          },
          {
            status:
              403,
          }
        );
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "split_booking_payment_confirmations"
          )
          .select(
            "id, batch_id, client_profile_id, price_confirmation_id, payment_plan_hash, payment_plan_snapshot, provider_count, payment_unit_count, total_amount_cents, currency, invalidated_at, consumed_at"
          )
          .eq(
            "id",
            run.payment_confirmation_id
          )
          .maybeSingle();

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      confirmation =
        data as unknown as
          ConfirmationRow |
          null;
    }
    else {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "split_booking_payment_confirmations"
          )
          .select(
            "id, batch_id, client_profile_id, price_confirmation_id, payment_plan_hash, payment_plan_snapshot, provider_count, payment_unit_count, total_amount_cents, currency, invalidated_at, consumed_at"
          )
          .eq(
            "batch_id",
            batchId
          )
          .eq(
            "client_profile_id",
            profile.id
          )
          .is(
            "invalidated_at",
            null
          )
          .is(
            "consumed_at",
            null
          )
          .order(
            "confirmed_at",
            {
              ascending:
                false,
            }
          )
          .limit(
            1
          )
          .maybeSingle();

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      confirmation =
        data as unknown as
          ConfirmationRow |
          null;
    }

    if (
      !confirmation ||
      confirmation.invalidated_at
    ) {
      return NextResponse.json(
        {
          error:
            "La confirmation finale du paiement est absente ou invalide.",

          code:
            "SPLIT_PAYMENT_CONFIRMATION_REQUIRED",
        },
        {
          status:
            409,
        }
      );
    }

    const plan =
      parsePaymentPlan(
        confirmation.payment_plan_snapshot
      );

    if (
      !plan ||
      plan.batchId !==
        batchId ||
      plan.providerCount !==
        plan.units.length ||
      plan.paymentUnitCount !==
        plan.units.length ||
      plan.providerCount <
        2
    ) {
      return NextResponse.json(
        {
          error:
            "Plan de paiement invalide.",

          code:
            "SPLIT_PAYMENT_PLAN_INVALID",
        },
        {
          status:
            409,
        }
      );
    }

    const computedHash =
      hashPlan(
        plan
      );

    if (
      computedHash !==
      confirmation.payment_plan_hash
    ) {
      return NextResponse.json(
        {
          error:
            "La preuve du plan de paiement ne correspond plus.",

          code:
            "SPLIT_PAYMENT_PLAN_HASH_MISMATCH",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      run &&
      run.payment_plan_hash !==
        computedHash
    ) {
      return NextResponse.json(
        {
          error:
            "Un autre plan de paiement a déjà commencé pour cette mission.",

          code:
            "SPLIT_PAYMENT_RUN_LOCKED",
        },
        {
          status:
            409,
        }
      );
    }

    const {
      data:
        priceData,

      error:
        priceError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_price_confirmations"
        )
        .select(
          "id, batch_id, price_snapshot, invalidated_at"
        )
        .eq(
          "id",
          plan.priceConfirmationId
        )
        .maybeSingle();

    if (
      priceError
    ) {
      throw new Error(
        priceError.message
      );
    }

    const priceProof =
      priceData as unknown as
        PriceProofRow |
        null;

    if (
      !priceProof ||
      priceProof.invalidated_at ||
      priceProof.batch_id !==
        batchId
    ) {
      return NextResponse.json(
        {
          error:
            "La preuve de prix n'est plus valide.",

          code:
            "SPLIT_PRICE_PROOF_INVALID",
        },
        {
          status:
            409,
        }
      );
    }

    const priceItems =
      parsePriceItems(
        priceProof.price_snapshot
      );

    const allBookingIds =
      priceItems.map(
        (
          item
        ) =>
          item.bookingId
      );

    const {
      data:
        bookingData,

      error:
        bookingError,
    } =
      await supabaseAdmin
        .from(
          "bookings"
        )
        .select(
          "*"
        )
        .in(
          "id",
          allBookingIds
        );

    if (
      bookingError
    ) {
      throw new Error(
        bookingError.message
      );
    }

    const bookings =
      (
        bookingData ??
        []
      ) as unknown as
        JsonRow[];

    const bookingById =
      new Map<
        string,
        JsonRow
      >();

    for (
      const booking
      of bookings
    ) {
      const id =
        text(
          booking.id
        );

      if (id) {
        bookingById.set(
          id,
          booking
        );
      }
    }

    if (
      bookings.length !==
      priceItems.length
    ) {
      return NextResponse.json(
        {
          error:
            "Les réservations de la mission ont changé.",

          code:
            "SPLIT_BOOKING_STRUCTURE_CHANGED",
        },
        {
          status:
            409,
        }
      );
    }

    for (
      const item
      of priceItems
    ) {
      const booking =
        bookingById.get(
          item.bookingId
        );

      if (
        !booking ||
        text(
          booking.parent_id
        ) !==
          profile.id ||
        !bookingAccepted(
          booking
        ) ||
        bookingAmount(
          booking
        ) !==
          item.amountCents ||
        text(
          booking.currency
        )
          .toUpperCase() !==
          item.currency
      ) {
        return NextResponse.json(
          {
            error:
              "Une réservation ne correspond plus à la confirmation.",

            code:
              "SPLIT_LIVE_BOOKING_CHANGED",
          },
          {
            status:
              409,
          }
        );
      }

      /*
       * Avant le démarrage d'un run split,
       * aucun child booking ne doit déjà
       * être payé ou avoir un Checkout.
       */
      if (
        !run &&
        paymentAlreadyClaimed(
          booking
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Une réservation possède déjà un paiement ou un Checkout.",

            code:
              "SPLIT_CHILD_ALREADY_HAS_PAYMENT",
          },
          {
            status:
              409,
          }
        );
      }
    }

    const providerIds =
      plan.units.map(
        (
          unit
        ) =>
          unit.providerId
      );

    const {
      data:
        providerData,

      error:
        providerError,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "*"
        )
        .in(
          "id",
          providerIds
        );

    if (
      providerError
    ) {
      throw new Error(
        providerError.message
      );
    }

    const providerById =
      new Map<
        string,
        JsonRow
      >();

    for (
      const provider
      of (
        providerData ??
        []
      ) as unknown as
        JsonRow[]
    ) {
      const id =
        text(
          provider.id
        );

      if (id) {
        providerById.set(
          id,
          provider
        );
      }
    }

    const stripeSecret =
      process.env
        .STRIPE_SECRET_KEY
        ?.trim();

    if (!stripeSecret) {
      throw new Error(
        "STRIPE_SECRET_KEY manquante."
      );
    }

    const stripe =
      new Stripe(
        stripeSecret
      );

    for (
      const unit
      of plan.units
    ) {
      const provider =
        providerById.get(
          unit.providerId
        );

      if (!provider) {
        return NextResponse.json(
          {
            error:
              "Prestataire introuvable.",

            code:
              "SPLIT_PROVIDER_NOT_FOUND",
          },
          {
            status:
              409,
          }
        );
      }

      const providerMarketAccess =
        assessKlyxStripeMarketAccess(
          text(
            provider.country_code
          ),
          stripeRuntime.mode
        );

      if (
        !providerMarketAccess.allowed
      ) {
        return NextResponse.json(
          {
            error:
              "KLYX n'est pas encore ouvert aux paiements réels dans le pays de ce prestataire.",

            code:
              "SPLIT_CHECKOUT_MARKET_NOT_READY",

            participant:
              "provider",

            countryCode:
              providerMarketAccess.countryCode,

            blockers:
              providerMarketAccess.blockers,
          },
          {
            status:
              409,
          }
        );
      }

      const liveAccountId =
        stripeAccountFromProfile(
          provider
        );

      if (
        liveAccountId !==
        unit.stripeAccountId
      ) {
        return NextResponse.json(
          {
            error:
              "Le compte Stripe d'un prestataire a changé.",

            code:
              "SPLIT_PROVIDER_STRIPE_CHANGED",
          },
          {
            status:
              409,
          }
        );
      }

      const account =
        await stripe.accounts.retrieve(
          liveAccountId
        );

      const deleted =
        (
          account as unknown as {
            deleted?:
              boolean;
          }
        ).deleted ===
        true;

      if (
        deleted ||
        account.charges_enabled !==
          true ||
        account.payouts_enabled !==
          true ||
        account.details_submitted !==
          true ||
        (
          account.requirements
            ?.currently_due
            ?.length ??
          0
        ) >
          0
      ) {
        return NextResponse.json(
          {
            error:
              "Un prestataire n'est plus prêt à recevoir un paiement Stripe.",

            code:
              "SPLIT_PROVIDER_STRIPE_NOT_READY",
          },
          {
            status:
              409,
          }
        );
      }
    }

    if (!run) {
      const {
        data:
          insertedRun,

        error:
          runError,
      } =
        await supabaseAdmin
          .from(
            "split_booking_payment_runs"
          )
          .insert({
            batch_id:
              batchId,

            client_profile_id:
              profile.id,

            payment_confirmation_id:
              confirmation.id,

            payment_plan_hash:
              computedHash,

            total_amount_cents:
              plan.totalAmountCents,

            currency:
              plan.currency,

            provider_count:
              plan.providerCount,

            payment_unit_count:
              plan.paymentUnitCount,

            status:
              "preparing",
          })
          .select(
            "id, batch_id, client_profile_id, payment_confirmation_id, payment_plan_hash, total_amount_cents, currency, provider_count, payment_unit_count, status"
          )
          .maybeSingle();

      if (
        runError &&
        runError.code !==
          "23505"
      ) {
        throw new Error(
          runError.message
        );
      }

      run =
        insertedRun as unknown as
          RunRow |
          null;

      if (!run) {
        run =
          await getExistingRun(
            batchId
          );
      }

      if (!run) {
        throw new Error(
          "Impossible de verrouiller le run de paiement split."
        );
      }
    }

    for (
      const unit
      of plan.units
    ) {
      const economics =
        calculateKlyxEconomics(
          unit.amountCents,
          getKlyxCommissionPercent()
        );

      const {
        error,
      } =
        await supabaseAdmin
          .from(
            "split_booking_payment_units"
          )
          .upsert(
            {
              run_id:
                run.id,

              batch_id:
                batchId,

              payment_confirmation_id:
                confirmation.id,

              client_profile_id:
                profile.id,

              provider_profile_id:
                unit.providerId,

              stripe_account_id:
                unit.stripeAccountId,

              amount_cents:
                unit.amountCents,

              currency:
                unit.currency,

              booking_ids:
                unit.bookingIds,

              slot_ids:
                unit.slotIds,

              application_fee_amount:
                economics.platformFeeCents,

              provider_amount_cents:
                economics.providerAmountCents,
            },
            {
              onConflict:
                "run_id,provider_profile_id",

              ignoreDuplicates:
                true,
            }
          );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }
    }

    let units =
      await getUnits(
        run.id
      );

    if (
      units.length !==
      plan.paymentUnitCount
    ) {
      throw new Error(
        "Nombre d'unités de paiement incohérent."
      );
    }

    const origin =
      process.env
        .NEXT_PUBLIC_APP_URL
        ?.trim() ||
      request.headers.get(
        "origin"
      ) ||
      "http://localhost:3000";

    for (
      const unit
      of units
    ) {
      const attemptToken =
        randomUUID();

      let {
        data:
          claimData,

        error:
          claimError,
      } =
        await supabaseAdmin.rpc(
          "klyx_claim_split_payment_unit_13_27",
          {
            p_unit_id:
              unit.id,

            p_client_profile_id:
              profile.id,

            p_attempt_token:
              attemptToken,
          }
        );

      if (
        claimError
      ) {
        throw new Error(
          claimError.message
        );
      }

      let claim =
        (
          (
            claimData ??
            []
          ) as unknown as
            ClaimRow[]
        )[0];

      if (!claim) {
        throw new Error(
          "Claim de paiement split absent."
        );
      }

      if (
        claim.action ===
        "busy"
      ) {
        return NextResponse.json(
          {
            error:
              "Une autre préparation de paiement est déjà en cours.",

            paymentPending:
              true,
          },
          {
            status:
              409,
          }
        );
      }

      if (
        claim.action ===
        "paid"
      ) {
        continue;
      }

      if (
        claim.action ===
          "reuse" &&
        claim.checkout_session_id
      ) {
        const existing =
          await stripe.checkout.sessions.retrieve(
            claim.checkout_session_id
          );

        if (
          existing.payment_status ===
          "paid"
        ) {
          /*
           * Le webhook fera la réconciliation.
           * Aucun second Checkout n'est créé.
           */
          continue;
        }

        if (
          existing.status ===
            "open" &&
          existing.url
        ) {
          continue;
        }

        if (
          existing.status ===
          "expired"
        ) {
          const {
            error:
              releaseError,
          } =
            await supabaseAdmin.rpc(
              "klyx_release_split_checkout_13_27",
              {
                p_unit_id:
                  unit.id,

                p_checkout_session_id:
                  existing.id,
              }
            );

          if (
            releaseError
          ) {
            throw new Error(
              releaseError.message
            );
          }

          const retryToken =
            randomUUID();

          const {
            data:
              retryData,

            error:
              retryError,
          } =
            await supabaseAdmin.rpc(
              "klyx_claim_split_payment_unit_13_27",
              {
                p_unit_id:
                  unit.id,

                p_client_profile_id:
                  profile.id,

                p_attempt_token:
                  retryToken,
              }
            );

          if (
            retryError
          ) {
            throw new Error(
              retryError.message
            );
          }

          claim =
            (
              (
                retryData ??
                []
              ) as unknown as
                ClaimRow[]
            )[0];

          if (
            !claim ||
            claim.action !==
              "create"
          ) {
            throw new Error(
              "Impossible de renouveler le Checkout expiré."
            );
          }

          claimData =
            retryData;

          claimError =
            retryError;

          /*
           * Le nouveau token doit correspondre
           * à celui utilisé pour attacher la session.
           */
          const planUnit =
            plan.units.find(
              (
                candidate
              ) =>
                candidate.providerId ===
                unit.provider_profile_id
            );

          if (!planUnit) {
            throw new Error(
              "Unité canonique introuvable."
            );
          }

          const economics =
            calculateKlyxEconomics(
              planUnit.amountCents,
              getKlyxCommissionPercent()
            );

          const metadata = {
            klyx_flow:
              "split_payment_13_27",

            split_batch_id:
              batchId,

            split_payment_run_id:
              run.id,

            split_payment_unit_id:
              unit.id,

            split_payment_confirmation_id:
              confirmation.id,

            provider_id:
              planUnit.providerId,
          };

          const session =
            await stripe.checkout.sessions.create(
              {
                mode:
                  "payment",

                customer_email:
                  user.email,

                success_url:
                  origin +
                  "/bookings/split/" +
                  batchId +
                  "?split_payment=success",

                cancel_url:
                  origin +
                  "/bookings/split/" +
                  batchId +
                  "?split_payment=cancelled",

                line_items: [
                  {
                    quantity:
                      1,

                    price_data: {
                      currency:
                        planUnit.currency.toLowerCase(),

                      unit_amount:
                        planUnit.amountCents,

                      product_data: {
                        name:
                          "Mission KLYX · paiement prestataire",
                      },
                    },
                  },
                ],

                metadata,

                payment_intent_data: {
                  application_fee_amount:
                    economics.platformFeeCents,

                  transfer_data: {
                    destination:
                      planUnit.stripeAccountId,
                  },

                  metadata,
                },
              },
              {
                idempotencyKey:
                  "klyx-split-unit-" +
                  unit.id +
                  "-attempt-" +
                  claim.attempt_number,
              }
            );

          if (!session.url) {
            throw new Error(
              "Stripe n'a pas retourné de lien Checkout."
            );
          }

          const {
            data:
              attached,

            error:
              attachError,
          } =
            await supabaseAdmin.rpc(
              "klyx_attach_split_checkout_13_27",
              {
                p_unit_id:
                  unit.id,

                p_attempt_token:
                  retryToken,

                p_checkout_session_id:
                  session.id,

                p_checkout_url:
                  session.url,
              }
            );

          if (
            attachError
          ) {
            throw new Error(
              attachError.message
            );
          }

          if (
            attached !==
            true
          ) {
            throw new Error(
              "Le verrou Checkout split a changé."
            );
          }

          continue;
        }

        continue;
      }

      if (
        claim.action !==
        "create"
      ) {
        continue;
      }

      const planUnit =
        plan.units.find(
          (
            candidate
          ) =>
            candidate.providerId ===
            unit.provider_profile_id
        );

      if (!planUnit) {
        throw new Error(
          "Unité canonique introuvable."
        );
      }

      const economics =
        calculateKlyxEconomics(
          planUnit.amountCents,
          getKlyxCommissionPercent()
        );

      const metadata = {
        klyx_flow:
          "split_payment_13_27",

        split_batch_id:
          batchId,

        split_payment_run_id:
          run.id,

        split_payment_unit_id:
          unit.id,

        split_payment_confirmation_id:
          confirmation.id,

        provider_id:
          planUnit.providerId,
      };

      const session =
        await stripe.checkout.sessions.create(
          {
            mode:
              "payment",

            customer_email:
              user.email,

            success_url:
              origin +
              "/bookings/split/" +
              batchId +
              "?split_payment=success",

            cancel_url:
              origin +
              "/bookings/split/" +
              batchId +
              "?split_payment=cancelled",

            line_items: [
              {
                quantity:
                  1,

                price_data: {
                  currency:
                    planUnit.currency.toLowerCase(),

                  unit_amount:
                    planUnit.amountCents,

                  product_data: {
                    name:
                      "Mission KLYX · paiement prestataire",
                  },
                },
              },
            ],

            metadata,

            payment_intent_data: {
              application_fee_amount:
                economics.platformFeeCents,

              transfer_data: {
                destination:
                  planUnit.stripeAccountId,
              },

              metadata,
            },
          },
          {
            idempotencyKey:
              "klyx-split-unit-" +
              unit.id +
              "-attempt-" +
              claim.attempt_number,
          }
        );

      if (!session.url) {
        throw new Error(
          "Stripe n'a pas retourné de lien Checkout."
        );
      }

      const {
        data:
          attached,

        error:
          attachError,
      } =
        await supabaseAdmin.rpc(
          "klyx_attach_split_checkout_13_27",
          {
            p_unit_id:
              unit.id,

            p_attempt_token:
              attemptToken,

            p_checkout_session_id:
              session.id,

            p_checkout_url:
              session.url,
          }
        );

      if (
        attachError
      ) {
        throw new Error(
          attachError.message
        );
      }

      if (
        attached !==
        true
      ) {
        throw new Error(
          "Le verrou Checkout split a changé."
        );
      }

      /*
       * Verrouille également les child bookings
       * contre l'ancien paiement individuel.
       */
      const {
        error:
          bookingLockError,
      } =
        await supabaseAdmin
          .from(
            "bookings"
          )
          .update({
            payment_status:
              "checkout_created",

            payment_mode:
              "connect_destination_split",

            stripe_checkout_session_id:
              session.id,

            payment_attempt_token:
              null,

            payment_checkout_started_at:
              null,
          })
          .in(
            "id",
            planUnit.bookingIds
          )
          .neq(
            "payment_status",
            "paid"
          );

      if (
        bookingLockError
      ) {
        throw new Error(
          bookingLockError.message
        );
      }
    }

    const {
      data:
        finalized,

      error:
        finalizeError,
    } =
      await supabaseAdmin.rpc(
        "klyx_finalize_split_payment_run_13_27",
        {
          p_run_id:
            run.id,

          p_client_profile_id:
            profile.id,
        }
      );

    if (
      finalizeError
    ) {
      throw new Error(
        finalizeError.message
      );
    }

    if (
      finalized !==
      true
    ) {
      throw new Error(
        "Toutes les unités Checkout ne sont pas encore prêtes."
      );
    }

    units =
      await getUnits(
        run.id
      );

    return NextResponse.json({
      prepared:
        true,

      runId:
        run.id,

      status:
        units.every(
          (
            unit
          ) =>
            unit.status ===
            "paid"
        )
          ? "paid"
          : units.some(
              (
                unit
              ) =>
                unit.status ===
                "paid"
            )
            ? "partially_paid"
            : "ready",

      totalAmountCents:
        plan.totalAmountCents,

      currency:
        plan.currency,

      paymentUnitCount:
        plan.paymentUnitCount,

      units:
        publicUnits(
          units
        ),

      proofConsumed:
        true,

      explicitStripeCheckoutRequired:
        true,

      automaticRedirect:
        false,

      automaticPayment:
        false,

      moneyMovedAutomatically:
        false,
    });
  }
  catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de préparer les paiements.";
    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "split_checkout_prepare_failed",
      route:
        "/api/bookings/split-missions/[id]/checkout",
      method: "POST",
      code:
        "split_checkout_prepare_failed",
      status,
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
      details: {
        automaticPayment:
          false,
        moneyMovedAutomatically:
          false,
      },
    });
  }
}
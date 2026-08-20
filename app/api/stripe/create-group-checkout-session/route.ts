import {
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
  markBookingGroupPaidFromSession,
} from "@/lib/stripe-group-payments";
import {
  assertStripeRuntimeReady,
} from "@/lib/stripe-runtime";
import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_CHECKOUT_12_86

type ClaimRow = {
  action:
    | "create"
    | "reuse"
    | "busy"
    | "paid";
  checkout_session_id:
    string | null;
  attempt_number: number;
};

function requiredEnv(
  name: string
) {
  const value =
    process.env[name]
      ?.trim();

  if (!value) {
    throw new Error(
      "Variable manquante : " +
      name
    );
  }

  return value;
}

function envIsTrue(
  name: string
) {
  return (
    process.env[name]
      ?.trim()
      .toLowerCase() ===
    "true"
  );
}

async function claim(
  groupId: string,
  clientId: string,
  token: string
): Promise<ClaimRow> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .rpc(
      "klyx_claim_booking_group_payment",
      {
        p_group_id:
          groupId,
        p_client_profile_id:
          clientId,
        p_attempt_token:
          token,
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  const row =
    (
      data ??
      []
    )[0] as
      | ClaimRow
      | undefined;

  if (!row) {
    throw new Error(
      "Verrou paiement groupe impossible."
    );
  }

  return row;
}

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
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

    assertStripeRuntimeReady();

    const stripeKey =
      requiredEnv(
        "STRIPE_SECRET_KEY"
      );

    const stripe =
      new Stripe(
        stripeKey
      );

    const body =
      (await request.json()) as {
        groupId?: string;
      };

    const groupId =
      body.groupId
        ?.trim() ??
      "";

    if (!groupId) {
      return NextResponse.json(
        {
          error:
            "Reservation groupee manquante.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: group,
      error: groupError,
    } = await supabaseAdmin
      .from(
        "booking_groups"
      )
      .select(
        "id, market_request_id, client_profile_id, provider_profile_id, user_service_id, status, payment_status, total_amount_cents, currency, payment_mode, application_fee_amount, stripe_checkout_session_id, cancellation_request_status"
      )
      .eq(
        "id",
        groupId
      )
      .maybeSingle();

    if (groupError) {
      throw new Error(
        groupError.message
      );
    }

    if (!group) {
      return NextResponse.json(
        {
          error:
            "Reservation groupee introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      group.client_profile_id !==
      profile.id
    ) {
      return NextResponse.json(
        {
          error:
            "Acces refuse.",
        },
        {
          status: 403,
        }
      );
    }

    // KLYX_GROUP_CANCEL_PAYMENT_GUARD_12_90
    if (
      group.cancellation_request_status ===
      "requested"
    ) {
      return NextResponse.json(
        {
          error:
            "Une demande d annulation est ouverte. Le paiement est suspendu jusqu a sa resolution.",
          code:
            "GROUP_CANCELLATION_PENDING",
        },
        {
          status: 409,
        }
      );
    }

    if (
      group.status !==
      "accepted"
    ) {
      return NextResponse.json(
        {
          error:
            "Le prestataire doit accepter tous les creneaux avant le paiement.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      group.payment_status ===
      "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette reservation groupee est deja payee.",
          alreadyPaid:
            true,
        },
        {
          status: 409,
        }
      );
    }

    const {
      data:
        childBookings,
      error:
        childError,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, status, payment_status, amount_total"
      )
      .eq(
        "booking_group_id",
        groupId
      )
      .order(
        "group_position",
        {
          ascending: true,
        }
      );

    if (childError) {
      throw new Error(
        childError.message
      );
    }

    if (
      !childBookings ||
      childBookings.length <
        2
    ) {
      throw new Error(
        "Les reservations du groupe sont introuvables."
      );
    }

    if (
      childBookings.some(
        (booking) =>
          booking.status !==
          "accepted"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Tous les creneaux doivent etre acceptes avant le paiement.",
        },
        {
          status: 409,
        }
      );
    }

    const childTotal =
      childBookings.reduce(
        (
          total,
          booking
        ) =>
          total +
          Number(
            booking.amount_total ??
            0
          ),
        0
      );

    const amountTotal =
      Number(
        group.total_amount_cents
      );

    if (
      amountTotal < 50 ||
      childTotal !==
        amountTotal
    ) {
      throw new Error(
        "Le montant du groupe ne correspond pas aux reservations."
      );
    }

    // KLYX_STRIPE_GROUP_CURRENCY_14_25
    const groupCurrency =
      String(
        group.currency ??
        ""
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z]{3}$/.test(
        groupCurrency
      )
    ) {
      throw new Error(
        "Devise du groupe invalide."
      );
    }

    const checkoutCurrency =
      groupCurrency.toLowerCase();
    const {
      data:
        userService,
      error:
        serviceLinkError,
    } = await supabaseAdmin
      .from(
        "user_services"
      )
      .select(
        "id, user_id, service_id, active"
      )
      .eq(
        "id",
        group.user_service_id
      )
      .eq(
        "user_id",
        group.provider_profile_id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

    if (
      serviceLinkError
    ) {
      throw new Error(
        serviceLinkError
          .message
      );
    }

    if (!userService) {
      throw new Error(
        "Le service du prestataire n est plus actif."
      );
    }

    const [
      providerResult,
      serviceResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled"
        )
        .eq(
          "id",
          group.provider_profile_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from("services")
        .select(
          "id, slug, name"
        )
        .eq(
          "id",
          userService.service_id
        )
        .maybeSingle(),
    ]);

    if (
      providerResult.error
    ) {
      throw new Error(
        providerResult
          .error.message
      );
    }

    if (
      serviceResult.error
    ) {
      throw new Error(
        serviceResult
          .error.message
      );
    }

    if (!serviceResult.data) {
      throw new Error(
        "Service KLYX introuvable."
      );
    }

    const provider =
      providerResult.data;

    const service =
      serviceResult.data;

    const providerReady =
      Boolean(
        provider
          ?.stripe_account_id &&
        provider
          ?.stripe_onboarding_complete &&
        provider
          ?.stripe_charges_enabled &&
        provider
          ?.stripe_payouts_enabled
      );

    const platformTest =
      stripeKey.startsWith(
        "sk_test_"
      ) &&
      envIsTrue(
        "KLYX_ALLOW_PLATFORM_ONLY_TEST_PAYMENTS"
      );

    if (
      !providerReady &&
      !platformTest
    ) {
      return NextResponse.json(
        {
          error:
            "Le prestataire doit terminer Stripe avant de recevoir le paiement.",
        },
        {
          status: 400,
        }
      );
    }

    const paymentMode =
      providerReady
        ? "connect_destination"
        : "platform_test_only";

    const economics =
      calculateKlyxEconomics(
        amountTotal,
        getKlyxCommissionPercent()
      );

    const fee =
      paymentMode ===
      "connect_destination"
        ? economics
            .platformFeeCents
        : 0;

    const providerAmount =
      paymentMode ===
      "connect_destination"
        ? amountTotal -
          fee
        : null;

    const origin =
      process.env
        .NEXT_PUBLIC_APP_URL
        ?.trim() ||
      request.headers.get(
        "origin"
      ) ||
      "http://localhost:3000";

    const metadata = {
      booking_group_id:
        group.id,
      provider_id:
        group.provider_profile_id,
      service_id:
        service.id,
      service_slug:
        service.slug,
      user_service_id:
        group.user_service_id,
      payment_mode:
        paymentMode,
    };

    const paymentIntentData:
      Stripe.Checkout.SessionCreateParams.PaymentIntentData =
      {
        metadata,
      };

    if (
      providerReady &&
      provider
        ?.stripe_account_id
    ) {
      paymentIntentData
        .application_fee_amount =
        fee;

      paymentIntentData
        .transfer_data = {
        destination:
          provider
            .stripe_account_id,
      };
    }

    const sessionParams:
      Stripe.Checkout.SessionCreateParams =
      {
        mode:
          "payment",

        customer_email:
          user.email,

        success_url:
          origin +
          "/booking-groups/" +
          group.id +
          "?payment=success&session_id={CHECKOUT_SESSION_ID}",

        cancel_url:
          origin +
          "/booking-groups/" +
          group.id,

        line_items: [
          {
            quantity: 1,
            price_data: {
              currency:
                checkoutCurrency,
              unit_amount:
                amountTotal,
              product_data: {
                name:
                  (
                    service.name
                      ?.trim() ||
                    service.slug
                  ) +
                  " · KLYX",

                description:
                  String(
                    childBookings.length
                  ) +
                  " creneaux · reservation groupee",
              },
            },
          },
        ],

        metadata,

        payment_intent_data:
          paymentIntentData,
      };

    let attemptToken =
      randomUUID();

    let paymentClaim =
      await claim(
        group.id,
        profile.id,
        attemptToken
      );

    if (
      paymentClaim.action ===
      "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette reservation groupee est deja payee.",
          alreadyPaid:
            true,
        },
        {
          status: 409,
        }
      );
    }

    if (
      paymentClaim.action ===
      "busy"
    ) {
      return NextResponse.json(
        {
          error:
            "Le paiement groupe est deja en cours de preparation.",
          paymentPending:
            true,
        },
        {
          status: 409,
        }
      );
    }

    if (
      paymentClaim.action ===
        "reuse" &&
      paymentClaim
        .checkout_session_id
    ) {
      const existing =
        await stripe
          .checkout
          .sessions
          .retrieve(
            paymentClaim
              .checkout_session_id
          );

      if (
        existing
          .payment_status ===
        "paid"
      ) {
        await markBookingGroupPaidFromSession(
          existing
        );

        return NextResponse.json(
          {
            error:
              "Cette reservation groupee est deja payee.",
            alreadyPaid:
              true,
          },
          {
            status: 409,
          }
        );
      }

      if (
        existing.status ===
          "open" &&
        existing.url
      ) {
        return NextResponse.json({
          url:
            existing.url,
          reused:
            true,
          paymentMode,
          amountTotal,
          groupId:
            group.id,
        });
      }

      if (
        existing.status !==
        "expired"
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe traite deja ce paiement groupe.",
            paymentPending:
              true,
          },
          {
            status: 409,
          }
        );
      }

      const {
        error:
          releaseError,
      } = await supabaseAdmin
        .from(
          "booking_groups"
        )
        .update({
          payment_status:
            "failed",
          stripe_checkout_session_id:
            null,
          payment_attempt_token:
            null,
          payment_checkout_started_at:
            null,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          group.id
        )
        .eq(
          "stripe_checkout_session_id",
          existing.id
        )
        .neq(
          "payment_status",
          "paid"
        );

      if (releaseError) {
        throw new Error(
          releaseError.message
        );
      }

      attemptToken =
        randomUUID();

      paymentClaim =
        await claim(
          group.id,
          profile.id,
          attemptToken
        );
    }

    if (
      paymentClaim.action !==
      "create"
    ) {
      return NextResponse.json(
        {
          error:
            "Le paiement groupe est deja en cours.",
          paymentPending:
            true,
        },
        {
          status: 409,
        }
      );
    }

    const session =
      await stripe
        .checkout
        .sessions
        .create(
          sessionParams,
          {
            idempotencyKey:
              "klyx-booking-group-" +
              group.id +
              "-attempt-" +
              String(
                paymentClaim
                  .attempt_number
              ),
          }
        );

    if (!session.url) {
      throw new Error(
        "Stripe n a pas renvoye de lien de paiement."
      );
    }

    const {
      data:
        updatedGroup,
      error:
        updateError,
    } = await supabaseAdmin
      .from(
        "booking_groups"
      )
      .update({
        payment_status:
          "processing",
        payment_mode:
          paymentMode,
        stripe_checkout_session_id:
          session.id,
        application_fee_amount:
          fee,
        platform_fee_amount:
          fee,
        provider_amount:
          providerAmount,
        payment_attempt_token:
          null,
        payment_checkout_started_at:
          null,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        group.id
      )
      .eq(
        "payment_attempt_token",
        attemptToken
      )
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    if (!updatedGroup) {
      const {
        data: latest,
        error:
          latestError,
      } = await supabaseAdmin
        .from(
          "booking_groups"
        )
        .select(
          "payment_status, stripe_checkout_session_id"
        )
        .eq(
          "id",
          group.id
        )
        .maybeSingle();

      if (latestError) {
        throw new Error(
          latestError.message
        );
      }

      if (
        latest
          ?.payment_status ===
        "paid"
      ) {
        return NextResponse.json(
          {
            error:
              "Cette reservation groupee est deja payee.",
            alreadyPaid:
              true,
          },
          {
            status: 409,
          }
        );
      }

      if (
        latest
          ?.stripe_checkout_session_id !==
        session.id
      ) {
        throw new Error(
          "Le verrou du paiement groupe a change."
        );
      }
    }

    return NextResponse.json({
      url:
        session.url,
      reused:
        false,
      paymentMode,
      amountTotal,
      groupId:
        group.id,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Paiement groupe impossible.";
    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "stripe_group_checkout_failed",
      route:
        "/api/stripe/create-group-checkout-session",
      method: "POST",
      code:
        "stripe_group_checkout_failed",
      status,
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

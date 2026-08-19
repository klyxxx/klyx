// KLYX_MARKET_OFFER_TRANSACTION_CURRENCY_PHASE_5C
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  validateProviderLiveMultiSlotCoverage,
} from "@/lib/multi-slot-live-coverage";
import { createMarketNotification } from "@/lib/market-notifications";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

async function klyxOfferBeforeAtomicRecovery13_10(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { id: requestId } = await context.params;
    const body = (await request.json()) as {
      amount?: unknown;
      message?: unknown;
    };

    const amount = Number(body.amount);
    const message = clean(body.message, 1500);

    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1000000
    ) {
      return NextResponse.json(
        { error: "Montant invalide." },
        { status: 400 }
      );
    }

    const {
      data: serviceRequest,
      error: requestError,
    } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, client_profile_id, service_id, country_code, currency, status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }

    if (!serviceRequest) {
      return NextResponse.json(
        { error: "Demande introuvable." },
        { status: 404 }
      );
    }

    if (serviceRequest.status !== "open") {
      return NextResponse.json(
        {
          error:
            "Cette demande n’accepte plus d’offres.",
        },
        { status: 409 }
      );
    }

    const {
      data: userService,
      error: userServiceError,
    } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", profile.id)
      .eq("service_id", serviceRequest.service_id)
      .eq("active", true)
      .eq("provider_enabled", true)
      .maybeSingle();

    if (userServiceError) {
      throw new Error(userServiceError.message);
    }

    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Tu ne proposes pas ce métier sur ton profil actif.",
        },
        { status: 403 }
      );
    }


    // KLYX_MULTI_SLOT_OFFER_SERVER_GUARD_12_94
    const {
      data: requestMetaData,
      error: requestMetaError,
    } = await supabaseAdmin
      .from(
        "market_service_requests"
      )
      .select(
        "id, request_mode, slot_count"
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

    if (requestMetaError) {
      throw new Error(
        requestMetaError.message
      );
    }

    const requestMeta =
      requestMetaData as unknown as {
        id: string;
        request_mode:
          | "single"
          | "multi_slot";
        slot_count: number;
      } | null;

    if (
      requestMeta?.request_mode ===
      "multi_slot"
    ) {
      const expectedSlotCount =
        Number(
          requestMeta.slot_count
        );

      if (
        !Number.isInteger(
          expectedSlotCount
        ) ||
        expectedSlotCount < 2
      ) {
        return NextResponse.json(
          {
            error:
              "Le planning multi-creneaux de cette mission est invalide.",
            code:
              "MULTI_SLOT_INVALID_SCHEDULE",
          },
          {
            status: 409,
          }
        );
      }

      if (
        amount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Le prix total de la mission doit etre superieur a 0.",
            code:
              "MULTI_SLOT_INVALID_OFFER_AMOUNT",
          },
          {
            status: 400,
          }
        );
      }

      const [
        candidateResult,
        slotResult,
      ] = await Promise.all([
        supabaseAdmin
          .from(
            "market_request_provider_candidates"
          )
          .select(
            "market_request_id, provider_profile_id, coverage_count, slot_count, full_coverage"
          )
          .eq(
            "market_request_id",
            requestId
          )
          .eq(
            "provider_profile_id",
            profile.id
          )
          .maybeSingle(),

        supabaseAdmin
          .from(
            "market_service_request_slots"
          )
          .select(
            "id, position"
          )
          .eq(
            "market_request_id",
            requestId
          ),
      ]);

      if (
        candidateResult.error
      ) {
        throw new Error(
          candidateResult
            .error.message
        );
      }

      if (
        slotResult.error
      ) {
        throw new Error(
          slotResult
            .error.message
        );
      }

      const candidate =
        candidateResult.data as unknown as {
          market_request_id:
            string;

          provider_profile_id:
            string;

          coverage_count:
            number;

          slot_count:
            number;

          full_coverage:
            boolean;
        } | null;

      const slotRows =
        (
          slotResult.data ??
          []
        ) as unknown as Array<{
          id: string;
          position: number;
        }>;

      const actualSlotCount =
        slotRows.length;

      if (
        actualSlotCount !==
        expectedSlotCount
      ) {
        return NextResponse.json(
          {
            error:
              "Le planning de cette mission a change. Recharge les opportunites KLYX avant de proposer un prix.",
            code:
              "MULTI_SLOT_SCHEDULE_CHANGED",
          },
          {
            status: 409,
          }
        );
      }

      const uniquePositions =
        new Set(
          slotRows.map(
            (slot) =>
              Number(
                slot.position
              )
          )
        );

      if (
        uniquePositions.size !==
        expectedSlotCount
      ) {
        return NextResponse.json(
          {
            error:
              "Les creneaux de cette mission ne sont plus coherents.",
            code:
              "MULTI_SLOT_SCHEDULE_INVALID",
          },
          {
            status: 409,
          }
        );
      }

      const candidateSlotCount =
        Number(
          candidate?.slot_count ??
          0
        );

      const coverageCount =
        Number(
          candidate?.coverage_count ??
          0
        );

      const eligible =
        Boolean(
          candidate &&
          candidate.provider_profile_id ===
            profile.id &&
          candidate.market_request_id ===
            requestId &&
          candidate.full_coverage ===
            true &&
          candidateSlotCount ===
            expectedSlotCount &&
          coverageCount ===
            expectedSlotCount
        );

      if (!eligible) {
        return NextResponse.json(
          {
            error:
              "Tu dois etre disponible sur tous les creneaux pour envoyer une offre sur cette mission groupee.",
            code:
              "MULTI_SLOT_FULL_COVERAGE_REQUIRED",

            coverage: {
              count:
                coverageCount,

              total:
                expectedSlotCount,

              fullCoverage:
                false,
            },
          },
          {
            status: 403,
          }
        );
      }
    }
    // KLYX_MULTI_SLOT_LIVE_OFFER_GUARD_12_95
    if (
      requestMeta?.request_mode ===
      "multi_slot"
    ) {
      const liveCoverage =
        await validateProviderLiveMultiSlotCoverage({
          requestId,

          providerProfileId:
            profile.id,

          userServiceId:
            userService.id,

          expectedSlotCount:
            Number(
              requestMeta.slot_count
            ),
        });

      /*
        Synchronise le snapshot candidat avec
        la verite du planning au moment du clic.
      */
      const {
        error:
          candidateSyncError,
      } = await supabaseAdmin
        .from(
          "market_request_provider_candidates"
        )
        .upsert(
          {
            market_request_id:
              requestId,

            provider_profile_id:
              profile.id,

            coverage_count:
              liveCoverage.coverageCount,

            slot_count:
              liveCoverage.slotCount,

            full_coverage:
              liveCoverage.fullCoverage,
          },
          {
            onConflict:
              "market_request_id,provider_profile_id",
          }
        );

      if (
        candidateSyncError
      ) {
        throw new Error(
          candidateSyncError.message
        );
      }

      if (
        !liveCoverage.fullCoverage
      ) {
        return NextResponse.json(
          {
            error:
              "Ton planning a change. Tu ne couvres plus tous les creneaux de cette mission.",

            code:
              "MULTI_SLOT_LIVE_COVERAGE_REQUIRED",

            coverage: {
              count:
                liveCoverage.coverageCount,

              total:
                liveCoverage.slotCount,

              fullCoverage:
                false,

              checkedAt:
                liveCoverage.checkedAt,

              slots:
                liveCoverage.slots.map(
                  (slot) => ({
                    position:
                      slot.position,

                    date:
                      slot.date,

                    startTime:
                      slot.startTime,

                    endTime:
                      slot.endTime,

                    covered:
                      slot.covered,

                    reason:
                      slot.reason,
                  })
                ),
            },
          },
          {
            status: 409,
          }
        );
      }
    }
    const { data: offer, error } = await supabaseAdmin
      .from("market_service_offers")
      .upsert(
        {
          request_id: requestId,
          provider_profile_id: profile.id,
          user_service_id: userService.id,
          country_code: serviceRequest.country_code,
          currency: serviceRequest.currency,
          amount,
          message: message || null,
          status: "sent",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "request_id,provider_profile_id",
        }
      )
      .select(
        "id, request_id, amount, country_code, currency, message, status, created_at, updated_at"
      )
      .single();

    if (error) throw new Error(error.message);
    await createMarketNotification({
      userId: serviceRequest.client_profile_id,
      marketRequestId: requestId,
      title: "Nouvelle offre reçue",
      message: `Un prestataire propose ${Number(amount).toFixed(2)} ${serviceRequest.currency} pour ta demande.`,
      href: "/requests",
    });

    return NextResponse.json({
      offer,
      message: "Offre envoyée au client.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’envoyer l’offre.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: requestId } = await context.params;
    const body = (await request.json()) as {
      offerId?: unknown;
      action?: unknown;
    };

    const offerId = clean(body.offerId, 80);
    const action = clean(body.action, 20);

    if (
      !offerId ||
      !["accept", "reject"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    const {
      data: serviceRequest,
      error: requestError,
    } = await supabaseAdmin
      .from("market_service_requests")
      .select(
        "id, client_profile_id, service_id, title, description, requested_date, requested_time, request_mode, country_code, currency, status, accepted_offer_id"
      )
      .eq("id", requestId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }

    if (!serviceRequest) {
      return NextResponse.json(
        { error: "Demande introuvable." },
        { status: 404 }
      );
    }

    // KLYX_MULTI_SLOT_ACCEPT_GUARD_12_84
    if (
      action === "accept" &&
      serviceRequest.request_mode === "multi_slot"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette demande contient plusieurs creneaux. Utilise le flux de reservation groupee KLYX.",
          code:
            "MULTI_SLOT_GROUP_BOOKING_REQUIRED",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: existingQuote,
      error: existingQuoteError,
    } = await supabaseAdmin
      .from("service_quotes")
      .select("id, market_request_id, status")
      .eq("market_request_id", requestId)
      .maybeSingle();

    if (existingQuoteError) {
      throw new Error(existingQuoteError.message);
    }

    if (
      action === "accept" &&
      existingQuote &&
      serviceRequest.accepted_offer_id === offerId
    ) {
      return NextResponse.json({
        quoteId: existingQuote.id,
        bookingHref: `/quotes/${existingQuote.id}/book`,
        message:
          "Cette offre est déjà acceptée. Tu peux finaliser la réservation.",
      });
    }

    if (serviceRequest.status !== "open") {
      return NextResponse.json(
        {
          error:
            "Cette demande n’est plus ouverte.",
        },
        { status: 409 }
      );
    }

    const { data: offer, error: offerError } =
      await supabaseAdmin
        .from("market_service_offers")
        .select(
          "id, request_id, provider_profile_id, user_service_id, amount, country_code, currency, message, status"
        )
        .eq("id", offerId)
        .eq("request_id", requestId)
        .maybeSingle();

    if (offerError) {
      throw new Error(offerError.message);
    }

    if (!offer) {
      return NextResponse.json(
        { error: "Offre introuvable." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      const { error } = await supabaseAdmin
        .from("market_service_offers")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("id", offerId)
        .eq("request_id", requestId);

      if (error) throw new Error(error.message);
      await createMarketNotification({
        userId: offer.provider_profile_id,
        marketRequestId: requestId,
        title: "Offre non retenue",
        message: "Ton offre n'a pas ete retenue pour cette demande.",
        href: "/provider/jobs",
      });

      return NextResponse.json({
        message: "Offre refusée.",
      });
    }

    if (offer.status !== "sent") {
      return NextResponse.json(
        {
          error:
            "Cette offre ne peut plus être acceptée.",
        },
        { status: 409 }
      );
    }

    if (
      !Number.isFinite(Number(offer.amount)) ||
      Number(offer.amount) <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Cette offre ne contient pas de prix valide.",
        },
        { status: 409 }
      );
    }

    const {
      data: linkedUserService,
      error: linkedServiceError,
    } = await supabaseAdmin
      .from("user_services")
      .select("id, service_id")
      .eq("id", offer.user_service_id)
      .eq("user_id", offer.provider_profile_id)
      .eq("service_id", serviceRequest.service_id)
      .eq("active", true)
      .eq("provider_enabled", true)
      .maybeSingle();

    if (linkedServiceError) {
      throw new Error(linkedServiceError.message);
    }

    if (!linkedUserService) {
      return NextResponse.json(
        {
          error:
            "Le métier lié à cette offre n’est plus actif.",
        },
        { status: 409 }
      );
    }

    const { data: quote, error: quoteError } =
      await supabaseAdmin
        .from("service_quotes")
        .insert({
          client_profile_id: profile.id,
          provider_profile_id:
            offer.provider_profile_id,
          user_service_id: offer.user_service_id,
          market_request_id: requestId,
          country_code: serviceRequest.country_code,
          currency: serviceRequest.currency,
          title: serviceRequest.title,
          description: serviceRequest.description,
          requested_date:
            serviceRequest.requested_date,
          requested_time:
            serviceRequest.requested_time,
          duration_hours: null,
          pricing_type: "fixed",
          unit_price: Number(offer.amount),
          quantity: 1,
          estimated_total: Number(offer.amount),
          provider_price: Number(offer.amount),
          provider_message: offer.message || null,
          status: "accepted",
          accepted_at: now,
          expires_at: null,
          updated_at: now,
        })
        .select("id")
        .single();

    if (quoteError) {
      if (
        quoteError.message.includes(
          "service_quotes_market_request_id_unique"
        )
      ) {
        const {
          data: duplicateQuote,
          error: duplicateError,
        } = await supabaseAdmin
          .from("service_quotes")
          .select("id")
          .eq("market_request_id", requestId)
          .single();

        if (duplicateError) {
          throw new Error(duplicateError.message);
        }

        return NextResponse.json({
          quoteId: duplicateQuote.id,
          bookingHref:
            `/quotes/${duplicateQuote.id}/book`,
          message:
            "Cette demande possède déjà un devis de réservation.",
        });
      }

      throw new Error(quoteError.message);
    }

    const { error: acceptedError } =
      await supabaseAdmin
        .from("market_service_offers")
        .update({
          status: "accepted",
          updated_at: now,
        })
        .eq("id", offerId)
        .eq("request_id", requestId);

    if (acceptedError) {
      throw new Error(acceptedError.message);
    }

    const { error: rejectOthersError } =
      await supabaseAdmin
        .from("market_service_offers")
        .update({
          status: "rejected",
          updated_at: now,
        })
        .eq("request_id", requestId)
        .neq("id", offerId)
        .eq("status", "sent");

    if (rejectOthersError) {
      throw new Error(rejectOthersError.message);
    }

    const { error: requestUpdateError } =
      await supabaseAdmin
        .from("market_service_requests")
        .update({
          status: "matched",
          accepted_offer_id: offerId,
          updated_at: now,
        })
        .eq("id", requestId)
        .eq("client_profile_id", profile.id)
        .eq("status", "open");

    if (requestUpdateError) {
      throw new Error(requestUpdateError.message);
    }

    await createMarketNotification({
      userId: offer.provider_profile_id,
      marketRequestId: requestId,
      title: "Offre acceptée",
      message: "Ton offre a été acceptée. Le client peut maintenant finaliser la reservation.",
      href: "/bookings",
    });
    return NextResponse.json({
      quoteId: quote.id,
      bookingHref: `/quotes/${quote.id}/book`,
      message:
        "Offre acceptée. Le prix est verrouillé. Finalise maintenant le créneau de réservation.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de modifier l’offre.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

// KLYX_MULTI_SLOT_OFFER_ATOMIC_RECOVERY_13_10

type KlyxOfferRouteContext13_10 = {
  params:
    Promise<{
      id:
        string;
    }>;
};

function klyxAtomicOfferRecovery13_10(
  message:
    string
) {
  const normalized =
    message.toUpperCase();

  if (
    normalized.includes(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_COVERAGE_REQUIRED"
    )
  ) {
    return Response.json(
      {
        code:
          "MULTI_SLOT_OFFER_AVAILABILITY_CHANGED",

        error:
          "Ton planning a change et tu ne couvres plus tous les creneaux de cette demande. KLYX a bloque l'offre.",

        recovery: {
          offerCreated:
            false,

          bookingCreated:
            false,

          paymentCreated:
            false,

          availabilityChanged:
            true,

          refreshJobs:
            true,

          reviewPlanning:
            true,

          retryAfterPlanningUpdate:
            true,
        },

        automaticOffer:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          409,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }

  if (
    normalized.includes(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_REQUEST_NOT_OPEN"
    )
  ) {
    return Response.json(
      {
        code:
          "MULTI_SLOT_OFFER_REQUEST_CLOSED",

        error:
          "Cette demande n'est plus ouverte aux nouvelles offres.",

        recovery: {
          offerCreated:
            false,

          bookingCreated:
            false,

          paymentCreated:
            false,

          refreshJobs:
            true,

          retryAllowed:
            false,
        },

        automaticOffer:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          409,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }

  if (
    normalized.includes(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_CONTEXT_REQUIRED"
    )
  ) {
    return Response.json(
      {
        code:
          "MULTI_SLOT_OFFER_CONTEXT_REQUIRED",

        error:
          "KLYX ne peut pas prouver le service exact utilise pour cette offre. L'envoi a ete bloque.",

        recovery: {
          offerCreated:
            false,

          bookingCreated:
            false,

          paymentCreated:
            false,

          refreshJobs:
            true,

          retryAllowed:
            false,
        },

        automaticOffer:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          409,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }

  if (
    normalized.includes(
      "KLYX_MULTI_SLOT_OFFER_ATOMIC_INVALID_SLOT_COUNT"
    )
  ) {
    return Response.json(
      {
        code:
          "MULTI_SLOT_OFFER_INVALID_SLOT_COUNT",

        error:
          "La demande multi-creneaux est incoherente. Aucune offre n'a ete enregistree.",

        recovery: {
          offerCreated:
            false,

          bookingCreated:
            false,

          paymentCreated:
            false,

          retryAllowed:
            false,
        },

        automaticOffer:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status:
          409,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }

  return null;
}

export async function POST(
  request:
    Request,

  context:
    KlyxOfferRouteContext13_10
) {
  /*
    Le handler historique conserve :
    - authentification prestataire
    - ownership
    - validation montant
    - garde 12.94
    - revalidation 12.95
    - upsert historique

    13.10 ne modifie que la traduction
    des blocages DB atomiques 13.09.
  */

  const safeRequest =
    request.clone();

  try {
    const response =
      await klyxOfferBeforeAtomicRecovery13_10(
        safeRequest,
        context
      );

    /*
      Le handler historique peut deja avoir
      transforme l'erreur Supabase en reponse.
    */
    if (
      response.status >=
      400
    ) {
      const inspected =
        response.clone();

      const raw =
        await inspected.text();

      const recovery =
        klyxAtomicOfferRecovery13_10(
          raw
        );

      if (recovery) {
        return recovery;
      }
    }

    return response;
  } catch (error) {
    /*
      Ou l'erreur PostgreSQL peut remonter
      directement jusqu'ici.
    */
    const message =
      error instanceof Error
        ? error.message
        : String(
            error
          );

    const recovery =
      klyxAtomicOfferRecovery13_10(
        message
      );

    if (recovery) {
      return recovery;
    }

    throw error;
  }
}

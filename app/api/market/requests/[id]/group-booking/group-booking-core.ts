import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  rankProvidersForMultiSlots,
} from "@/lib/market-multi-slot";
import {
  isUserServiceApproved,
} from "@/lib/provider-skill-publication";

// KLYX_GROUP_BOOKING_CREATE_12_85

type SlotRow = {
  position: number;
  requested_date: string;
  start_time: string;
  end_time: string;
  budget_max: number | null;
  duration_minutes: number;
};

function time5(
  value: string
) {
  return value.slice(
    0,
    5
  );
}

function minutes(
  value: string
) {
  const match =
    /^(\d{2}):(\d{2})/.exec(
      value
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) *
      60 +
    Number(match[2])
  );
}

function overlaps(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) {
  const a =
    minutes(firstStart);

  const b =
    minutes(firstEnd);

  const c =
    minutes(secondStart);

  const d =
    minutes(secondEnd);

  if (
    a == null ||
    b == null ||
    c == null ||
    d == null
  ) {
    return false;
  }

  return (
    a < d &&
    b > c
  );
}

async function klyxGroupBookingPostBeforeRecovery(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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
      id: requestId,
    } =
      await context.params;

    const body =
      (await request.json()) as {
        offerId?: string;
      };

    const offerId =
      body.offerId
        ?.trim() ??
      "";

    if (!offerId) {
      return NextResponse.json(
        {
          error:
            "Offre manquante.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: existingGroup,
      error:
        existingGroupError,
    } = await supabaseAdmin
      .from(
        "booking_groups"
      )
      .select(
        "id, offer_id, status"
      )
      .eq(
        "market_request_id",
        requestId
      )
      .eq(
        "client_profile_id",
        profile.id
      )
      .in(
        "status",
        [
          "pending_provider",
          "accepted",
        ]
      )
      .maybeSingle();

    if (
      existingGroupError
    ) {
      throw new Error(
        existingGroupError
          .message
      );
    }

    if (existingGroup) {
      return NextResponse.json({
        groupId:
          existingGroup.id,
        existing:
          true,
        href:
          "/booking-groups/" +
          existingGroup.id,
      });
    }

    const {
      data:
        marketRequest,
      error: requestError,
    } = await supabaseAdmin
      .from(
        "market_service_requests"
      )
      .select(
        "id, client_profile_id, service_id, title, city, status, request_mode, slot_count"
      )
      .eq(
        "id",
        requestId
      )
      .eq(
        "client_profile_id",
        profile.id
      )
      .maybeSingle();

    if (requestError) {
      throw new Error(
        requestError.message
      );
    }

    if (!marketRequest) {
      return NextResponse.json(
        {
          error:
            "Demande KLYX introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      marketRequest.request_mode !==
      "multi_slot"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette demande n est pas multi-creneaux.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      marketRequest.status !==
      "open"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette demande n est plus ouverte.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: offer,
      error: offerError,
    } = await supabaseAdmin
      .from(
        "market_service_offers"
      )
      .select(
        "id, request_id, provider_profile_id, user_service_id, amount, status"
      )
      .eq(
        "id",
        offerId
      )
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

    if (offerError) {
      throw new Error(
        offerError.message
      );
    }

    if (!offer) {
      return NextResponse.json(
        {
          error:
            "Offre introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      offer.status !==
      "sent"
    ) {
      return NextResponse.json(
        {
          error:
            "Cette offre ne peut plus etre selectionnee.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      !Number.isFinite(
        Number(
          offer.amount
        )
      ) ||
      Number(
        offer.amount
      ) <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Prix de l offre invalide.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data:
        linkedService,
      error:
        linkedServiceError,
    } = await supabaseAdmin
      .from(
        "user_services"
      )
      .select(
        "id, user_id, service_id"
      )
      .eq(
        "id",
        offer.user_service_id
      )
      .eq(
        "user_id",
        offer.provider_profile_id
      )
      .eq(
        "service_id",
        marketRequest.service_id
      )
      .eq(
        "active",
        true
      )
      .eq(
        "provider_enabled",
        true
      )
      .maybeSingle();

    if (
      linkedServiceError
    ) {
      throw new Error(
        linkedServiceError
          .message
      );
    }

    if (!linkedService) {
      return NextResponse.json(
        {
          error:
            "Le service du prestataire n est plus actif.",
        },
        {
          status: 409,
        }
      );
    }

    const skillApproved =
      await isUserServiceApproved({
        profileId:
          offer.provider_profile_id,
        userServiceId:
          offer.user_service_id,
      });

    if (!skillApproved) {
      return NextResponse.json(
        {
          error:
            "Le metier du prestataire n est plus valide pour une reservation.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: slotData,
      error: slotError,
    } = await supabaseAdmin
      .from(
        "market_service_request_slots"
      )
      .select(
        "position, requested_date, start_time, end_time, budget_max, duration_minutes"
      )
      .eq(
        "market_request_id",
        requestId
      )
      .order(
        "position",
        {
          ascending: true,
        }
      );

    if (slotError) {
      throw new Error(
        slotError.message
      );
    }

    const slots =
      (
        slotData ??
        []
      ) as SlotRow[];

    if (
      slots.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Les creneaux groupes sont introuvables.",
        },
        {
          status: 409,
        }
      );
    }

    for (
      const slot
      of slots
    ) {
      const start =
        minutes(
          slot.start_time
        );

      const end =
        minutes(
          slot.end_time
        );

      if (
        start == null ||
        end == null ||
        end <= start
      ) {
        return NextResponse.json(
          {
            error:
              "Les creneaux passant minuit seront pris en charge dans une evolution dediee.",
          },
          {
            status: 409,
          }
        );
      }
    }

    const candidates =
      await rankProvidersForMultiSlots({
        serviceId:
          marketRequest.service_id,
        slots:
          slots.map(
            (slot) => ({
              date:
                slot.requested_date,
              startTime:
                time5(
                  slot.start_time
                ),
              endTime:
                time5(
                  slot.end_time
                ),
              budget:
                slot.budget_max ==
                null
                  ? null
                  : Number(
                      slot.budget_max
                    ),
            })
          ),
      });

    const candidate =
      candidates.find(
        (item) =>
          item.providerProfileId ===
          offer.provider_profile_id
      );

    if (
      !candidate ||
      !candidate.fullCoverage
    ) {
      return NextResponse.json(
        {
          error:
            "Le planning du prestataire a change. Il ne couvre plus tous les creneaux.",
          coverage:
            candidate?.coverageCount ??
            0,
          total:
            slots.length,
        },
        {
          status: 409,
        }
      );
    }

    const dates =
      [
        ...new Set(
          slots.map(
            (slot) =>
              slot.requested_date
          )
        ),
      ];

    const {
      data:
        clientBookings,
      error:
        clientBookingsError,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_date, start_time, end_time"
      )
      .eq(
        "parent_id",
        profile.id
      )
      .in(
        "booking_date",
        dates
      )
      .in(
        "status",
        [
          "pending",
          "accepted",
        ]
      );

    if (
      clientBookingsError
    ) {
      throw new Error(
        clientBookingsError
          .message
      );
    }

    const clientConflict =
      slots.some(
        (slot) =>
          (
            clientBookings ??
            []
          ).some(
            (booking) =>
              booking.booking_date ===
                slot.requested_date &&
              overlaps(
                time5(
                  slot.start_time
                ),
                time5(
                  slot.end_time
                ),
                time5(
                  booking.start_time
                ),
                time5(
                  booking.end_time
                )
              )
          )
      );

    if (clientConflict) {
      return NextResponse.json(
        {
          error:
            "Tu as deja une reservation sur au moins un de ces creneaux.",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data: groupIdData,
      error: groupError,
    } = await supabaseAdmin
      .rpc(
        "klyx_create_multi_slot_booking_group",
        {
          p_market_request_id:
            requestId,
          p_client_profile_id:
            profile.id,
          p_offer_id:
            offerId,
        }
      );

    if (groupError) {
      throw new Error(
        groupError.message
      );
    }

    const groupId =
      typeof groupIdData ===
      "string"
        ? groupIdData
        : String(
            groupIdData ??
            ""
          );

    if (!groupId) {
      throw new Error(
        "Le groupe de reservation n a pas ete cree."
      );
    }

    const {
      data:
        createdBookings,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, group_position"
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

    const firstBookingId =
      createdBookings?.[0]
        ?.id ??
      null;

    await supabaseAdmin
      .from(
        "user_notifications"
      )
      .upsert(
        {
          user_id:
            offer.provider_profile_id,
          booking_id:
            firstBookingId,
          market_request_id:
            requestId,
          type:
            "booking_created",
          title:
            "Nouvelle reservation groupee",
          message:
            String(
              slots.length
            ) +
            " creneaux ont ete selectionnes avec toi. Confirme le groupe complet.",
          href:
            "/booking-groups/" +
            groupId,
          deduplication_key:
            "booking-group:" +
            groupId +
            ":provider-pending",
        },
        {
          onConflict:
            "deduplication_key",
          ignoreDuplicates:
            true,
        }
      );

    return NextResponse.json({
      groupId,
      bookingIds:
        (
          createdBookings ??
          []
        ).map(
          (item) =>
            item.id
        ),
      slotCount:
        slots.length,
      status:
        "pending_provider",
      paymentStatus:
        "unpaid",
      href:
        "/booking-groups/" +
        groupId,
      message:
        "Reservation groupee creee. Le prestataire doit maintenant confirmer tous les creneaux.",
      automaticPayment:
        false,
    });
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "Reservation groupee impossible.";

    const message =
      raw.includes(
        "KLYX_GROUP_REQUEST_NOT_OPEN"
      )
        ? "La demande vient d etre modifiee. Actualise la page."
        : raw.includes(
              "KLYX_GROUP_OFFER_NOT_AVAILABLE"
            )
          ? "Cette offre ne peut plus etre selectionnee."
          : raw;

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}

// KLYX_GROUP_STALE_PROVIDER_RECOVERY_12_97

type KlyxGroupLiveCoverageRpc = {
  ok?: boolean;
  code?: string;
  coverageCount?: number;
  slotCount?: number;
  fullCoverage?: boolean;
  checkedAt?: string;
};

type KlyxRecoveryOfferRow = {
  id: string;
  request_id: string;
  provider_profile_id: string;
  user_service_id: string;
  status: string;
};

type KlyxRecoveryRequestRow = {
  id: string;
  client_profile_id: string;
  request_mode: string;
  slot_count: number;
  status: string;
};

async function klyxRecoverStaleGroupSelection(
  request: Request,
  context: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  const {
    profile,
  } =
    await getAuthenticatedProfile(
      request
    );

  if (
    profile.accountType !==
    "client"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette action est reservee au client.",
        code:
          "GROUP_RECOVERY_CLIENT_REQUIRED",
      },
      {
        status: 403,
      }
    );
  }

  const {
    id:
      requestId,
  } =
    await context.params;

  const body =
    (await request.json()) as {
      offerId?: unknown;
    };

  const offerId =
    typeof body.offerId ===
      "string"
      ? body.offerId.trim()
      : "";

  if (!offerId) {
    return NextResponse.json(
      {
        error:
          "Offre introuvable pour la recuperation KLYX.",
        code:
          "GROUP_RECOVERY_OFFER_REQUIRED",
      },
      {
        status: 400,
      }
    );
  }

  const [
    requestResult,
    offerResult,
  ] =
    await Promise.all([
      supabaseAdmin
        .from(
          "market_service_requests"
        )
        .select(
          "id, client_profile_id, request_mode, slot_count, status"
        )
        .eq(
          "id",
          requestId
        )
        .maybeSingle(),

      supabaseAdmin
        .from(
          "market_service_offers"
        )
        .select(
          "id, request_id, provider_profile_id, user_service_id, status"
        )
        .eq(
          "id",
          offerId
        )
        .eq(
          "request_id",
          requestId
        )
        .maybeSingle(),
    ]);

  if (
    requestResult.error
  ) {
    throw new Error(
      requestResult.error.message
    );
  }

  if (
    offerResult.error
  ) {
    throw new Error(
      offerResult.error.message
    );
  }

  const marketRequest =
    requestResult.data
      ? requestResult.data as unknown as
          KlyxRecoveryRequestRow
      : null;

  const offer =
    offerResult.data
      ? offerResult.data as unknown as
          KlyxRecoveryOfferRow
      : null;

  if (!marketRequest) {
    return NextResponse.json(
      {
        error:
          "Demande KLYX introuvable.",
        code:
          "GROUP_RECOVERY_REQUEST_NOT_FOUND",
      },
      {
        status: 404,
      }
    );
  }

  if (
    marketRequest.client_profile_id !==
    profile.id
  ) {
    return NextResponse.json(
      {
        error:
          "Cette demande ne t appartient pas.",
        code:
          "GROUP_RECOVERY_ACCESS_DENIED",
      },
      {
        status: 403,
      }
    );
  }

  if (
    marketRequest.request_mode !==
    "multi_slot"
  ) {
    return NextResponse.json(
      {
        error:
          "Cette recuperation concerne uniquement une mission multi-creneaux.",
        code:
          "GROUP_RECOVERY_NOT_MULTI_SLOT",
      },
      {
        status: 409,
      }
    );
  }

  if (!offer) {
    return NextResponse.json(
      {
        error:
          "L offre selectionnee est introuvable.",
        code:
          "GROUP_RECOVERY_OFFER_NOT_FOUND",
      },
      {
        status: 404,
      }
    );
  }

  const {
    data:
      coverageData,

    error:
      coverageError,
  } = await supabaseAdmin
    .rpc(
      "klyx_group_live_coverage_check",
      {
        p_request_id:
          requestId,

        p_provider_profile_id:
          offer.provider_profile_id,

        p_user_service_id:
          offer.user_service_id,
      }
    );

  if (
    coverageError
  ) {
    throw new Error(
      coverageError.message
    );
  }

  const coverage =
    (
      coverageData ??
      {}
    ) as unknown as
      KlyxGroupLiveCoverageRpc;

  const coverageCount =
    Number(
      coverage.coverageCount ??
      0
    );

  const slotCount =
    Number(
      coverage.slotCount ??
      marketRequest.slot_count ??
      0
    );

  /*
    Cas tres rare :
    le trigger a bloque mais la disponibilite
    est redevenue correcte entre les deux checks.

    KLYX ne cree rien automatiquement.
    Le client doit simplement reessayer.
  */
  if (
    coverage.ok ===
      true &&
    coverage.fullCoverage ===
      true &&
    coverageCount ===
      slotCount
  ) {
    return NextResponse.json(
      {
        error:
          "Le planning du prestataire vient de changer. Recharge la mission puis confirme a nouveau ton choix.",
        code:
          "GROUP_PROVIDER_RETRY_REQUIRED",

        requestId,
        offerId,

        coverage: {
          count:
            coverageCount,

          total:
            slotCount,

          fullCoverage:
            true,

          checkedAt:
            coverage.checkedAt ??
            null,
        },

        automaticBooking:
          false,

        automaticPayment:
          false,

        href:
          "/assistant/market/" +
          requestId,
      },
      {
        status: 409,
      }
    );
  }

  /*
    La candidature stockee devient coherente
    avec la disponibilite reelle.

    L offre elle-meme reste intacte :
    KLYX ne refuse pas automatiquement
    une proposition commerciale du prestataire.
  */
  const {
    error:
      candidateError,
  } = await supabaseAdmin
    .from(
      "market_request_provider_candidates"
    )
    .upsert(
      {
        market_request_id:
          requestId,

        provider_profile_id:
          offer.provider_profile_id,

        coverage_count:
          Math.max(
            0,
            coverageCount
          ),

        slot_count:
          Math.max(
            0,
            slotCount
          ),

        full_coverage:
          false,
      },
      {
        onConflict:
          "market_request_id,provider_profile_id",
      }
    );

  if (
    candidateError
  ) {
    throw new Error(
      candidateError.message
    );
  }

  /*
    Aucun update de market_service_requests.
    L echec atomique 12.96 a deja rollback
    toute tentative de creation du groupe.

    La demande reste donc disponible pour
    choisir un autre prestataire.
  */

  return NextResponse.json(
    {
      error:
        "Ce prestataire ne couvre plus tous les creneaux. Aucune reservation n a ete creee. Choisis une autre offre.",

      code:
        "GROUP_PROVIDER_AVAILABILITY_CHANGED",

      requestId,
      offerId,

      providerProfileId:
        offer.provider_profile_id,

      requestStatus:
        marketRequest.status,

      coverage: {
        count:
          Math.max(
            0,
            coverageCount
          ),

        total:
          Math.max(
            0,
            slotCount
          ),

        fullCoverage:
          false,

        reason:
          coverage.code ??
          "GROUP_LIVE_COVERAGE_REQUIRED",

        checkedAt:
          coverage.checkedAt ??
          null,
      },

      recovery: {
        groupCreated:
          false,

        childBookingsCreated:
          false,

        paymentCreated:
          false,

        candidateResynchronized:
          true,

        chooseAnotherProvider:
          true,
      },

      automaticBooking:
        false,

      automaticPayment:
        false,

      href:
        "/assistant/market/" +
        requestId,
    },
    {
      status: 409,
    }
  );
}

export async function POST(
  request: Request,
  context: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  /*
    Le clone est cree AVANT que la route 12.85
    consomme le body.
  */
  const recoveryRequest =
    request.clone();

  const response =
    await klyxGroupBookingPostBeforeRecovery(
      request,
      context
    );

  if (
    response.ok
  ) {
    return response;
  }

  let errorMessage =
    "";

  try {
    const body =
      (await response
        .clone()
        .json()) as {
          error?: unknown;
        };

    errorMessage =
      typeof body.error ===
        "string"
        ? body.error
        : "";
  } catch {
    return response;
  }

  /*
    Seul le blocage atomique 12.96
    declenche cette recuperation.
    Toutes les autres erreurs gardent
    exactement leur comportement precedent.
  */
  if (
    !errorMessage.includes(
      "KLYX_GROUP_LIVE_COVERAGE_REQUIRED"
    )
  ) {
    return response;
  }

  try {
    return await klyxRecoverStaleGroupSelection(
      recoveryRequest,
      context
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Recuperation KLYX impossible.";

    return NextResponse.json(
      {
        error:
          message,

        code:
          "GROUP_PROVIDER_RECOVERY_FAILED",

        automaticBooking:
          false,

        automaticPayment:
          false,
      },
      {
        status: 500,
      }
    );
  }
}

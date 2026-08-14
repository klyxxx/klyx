import {
  NextResponse,
} from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

import {
  buildLiveMultiProviderSplitPlan,
} from "@/lib/multi-provider-split-plan";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_MULTI_PROVIDER_SPLIT_API_12_99

type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
};

type RequestRow = {
  id:
    string;

  client_profile_id:
    string;

  service_id:
    string;

  title:
    string;

  city:
    string;

  request_mode:
    string;

  slot_count:
    number;

  status:
    string;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
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
            "Cette analyse est reservee au client.",
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

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "market_service_requests"
      )
      .select(
        "id, client_profile_id, service_id, title, city, request_mode, slot_count, status"
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    const marketRequest =
      data
        ? data as unknown as
            RequestRow
        : null;

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
      marketRequest.client_profile_id !==
      profile.id
    ) {
      return NextResponse.json(
        {
          error:
            "Cette demande ne t appartient pas.",
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
            "Le plan multi-prestataires concerne uniquement les missions multi-creneaux.",

          code:
            "SPLIT_PLAN_MULTI_SLOT_REQUIRED",
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

          code:
            "SPLIT_PLAN_REQUEST_NOT_OPEN",
        },
        {
          status: 409,
        }
      );
    }

    const plan =
      await buildLiveMultiProviderSplitPlan({
        requestId:
          marketRequest.id,

        serviceId:
          marketRequest.service_id,

        expectedSlotCount:
          Number(
            marketRequest.slot_count
          ),
      });

    let message =
      "";

    if (
      plan.mode ===
      "single_provider_available"
    ) {
      message =
        "Un prestataire couvre encore tous les creneaux. KLYX le privilegie avant toute repartition.";
    } else if (
      plan.mode ===
      "split_available"
    ) {
      message =
        "Aucun prestataire unique ne couvre toute la mission, mais KLYX a trouve une combinaison de " +
        String(
          plan.providerCount
        ) +
        " prestataires couvrant tous les creneaux.";
    } else {
      message =
        plan.uncoveredPositions.length >
        0
          ? "KLYX ne peut pas encore couvrir tous les creneaux. Les creneaux " +
            plan.uncoveredPositions.join(
              ", "
            ) +
            " restent sans prestataire compatible."
          : "Aucune combinaison suffisamment sure n est disponible.";
    }

    return NextResponse.json({
      request: {
        id:
          marketRequest.id,

        title:
          marketRequest.title,

        city:
          marketRequest.city,

        slotCount:
          Number(
            marketRequest.slot_count
          ),

        status:
          marketRequest.status,
      },

      plan,

      message,

      execution: {
        automaticSelection:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,

        clientConfirmationRequired:
          true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de calculer le plan multi-prestataires.";

    return NextResponse.json(
      {
        error:
          message,

        automaticSelection:
          false,

        automaticBooking:
          false,

        automaticPayment:
          false,
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
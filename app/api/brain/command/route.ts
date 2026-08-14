import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  getBrainActions,
  type BrainActionItem,
} from "@/lib/brain-actions";

// KLYX_TRUSTED_COMMAND_ROUTER_12_81

type CommandBody = {
  message?: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(
  value: string,
  expressions: string[]
) {
  return expressions.some(
    (expression) =>
      value.includes(expression)
  );
}

function actionIntentScore(
  action: BrainActionItem,
  message: string
) {
  let score = action.priority;

  if (
    action.kind ===
      "payment_pending" &&
    includesAny(
      message,
      [
        "payer",
        "paiement",
        "payement",
        "regler",
        "carte bancaire",
      ]
    )
  ) {
    score += 2000;
  }

  if (
    (
      action.kind ===
        "track_mission" ||
      action.kind ===
        "provider_track_mission"
    ) &&
    includesAny(
      message,
      [
        "suivre",
        "suivi",
        "ou en est",
        "ou est le prestataire",
        "prestataire en route",
        "prestataire arrive",
        "etat de la mission",
        "etat de la prestation",
      ]
    )
  ) {
    score += 1900;
  }

  if (
    action.kind ===
      "confirm_completion" &&
    includesAny(
      message,
      [
        "confirmer la fin",
        "confirmer mission",
        "confirmer la mission",
        "mission terminee",
        "prestation terminee",
        "travail termine",
      ]
    )
  ) {
    score += 2100;
  }

  if (
    action.kind ===
      "provider_finish_mission" &&
    includesAny(
      message,
      [
        "declarer la fin",
        "terminer la mission",
        "finir la mission",
        "mission finie",
        "travail fini",
      ]
    )
  ) {
    score += 2100;
  }

  if (
    action.kind ===
      "provider_booking_request" &&
    includesAny(
      message,
      [
        "nouvelle reservation",
        "demande client",
        "accepter la reservation",
        "refuser la reservation",
        "repondre au client",
      ]
    )
  ) {
    score += 1900;
  }

  if (
    action.kind ===
      "compare_offers" &&
    includesAny(
      message,
      [
        "comparer les offres",
        "voir les offres",
        "choisir une offre",
        "choisir prestataire",
      ]
    )
  ) {
    score += 1800;
  }

  if (
    action.kind ===
      "finalize_booking" &&
    includesAny(
      message,
      [
        "finaliser la reservation",
        "choisir le creneau",
        "confirmer le creneau",
      ]
    )
  ) {
    score += 1800;
  }

  if (
    action.kind ===
      "review_completed" &&
    includesAny(
      message,
      [
        "laisser un avis",
        "donner mon avis",
        "noter le prestataire",
      ]
    )
  ) {
    score += 1700;
  }

  return score;
}

function hasSpecificExistingIntent(
  message: string
) {
  return includesAny(
    message,
    [
      "payer",
      "paiement",
      "payement",
      "regler",
      "suivre",
      "suivi",
      "ou en est",
      "ou est le prestataire",
      "confirmer la fin",
      "confirmer mission",
      "mission terminee",
      "prestation terminee",
      "declarer la fin",
      "terminer la mission",
      "finir la mission",
      "nouvelle reservation",
      "demande client",
      "comparer les offres",
      "voir les offres",
      "choisir une offre",
      "finaliser la reservation",
      "choisir le creneau",
      "laisser un avis",
      "donner mon avis",
    ]
  );
}

function hasGeneralActionIntent(
  message: string
) {
  return includesAny(
    message,
    [
      "que dois je faire",
      "quoi faire maintenant",
      "prochaine action",
      "prochaine etape",
      "quelle est la suite",
      "continuer ma demande",
      "reprendre ma demande",
      "mes actions",
      "ma priorite",
    ]
  );
}

function hasNewNeedIntent(
  message: string
) {
  return includesAny(
    message,
    [
      "j ai besoin de",
      "je cherche",
      "trouve moi",
      "trouver quelqu un",
      "cherche quelqu un",
      "besoin d un",
      "besoin d une",
      "je voudrais un",
      "je voudrais une",
    ]
  );
}

function bestAction(
  actions: BrainActionItem[],
  message: string
) {
  if (actions.length === 0) {
    return null;
  }

  return [...actions].sort(
    (first, second) =>
      actionIntentScore(
        second,
        message
      ) -
      actionIntentScore(
        first,
        message
      )
  )[0] ?? null;
}

export async function POST(
  request: Request
) {
  try {
    const { profile } =
      await getAuthenticatedProfile(
        request
      );

    const body =
      (await request.json()) as CommandBody;

    const rawMessage =
      body.message?.trim() ?? "";

    if (!rawMessage) {
      return NextResponse.json(
        {
          error:
            "Message manquant.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      rawMessage.length > 700
    ) {
      return NextResponse.json(
        {
          error:
            "Message trop long.",
        },
        {
          status: 400,
        }
      );
    }

    const message =
      normalize(rawMessage);

    // IMPORTANT 12.81:
    // actions recalculated from DB server-side.
    const actions =
      (
        await getBrainActions(
          profile
        )
      ).slice(0, 20);

    const specificExistingIntent =
      hasSpecificExistingIntent(
        message
      );

    const generalActionIntent =
      hasGeneralActionIntent(
        message
      );

    const newNeedIntent =
      hasNewNeedIntent(
        message
      );

    if (
      actions.length > 0 &&
      (
        specificExistingIntent ||
        generalActionIntent
      )
    ) {
      const action =
        bestAction(
          actions,
          message
        );

      if (action) {
        return NextResponse.json({
          mode:
            "existing_action",
          automaticExecutionAllowed:
            false,
          action,
        });
      }
    }

    if (
      newNeedIntent ||
      !generalActionIntent
    ) {
      const params =
        new URLSearchParams();

      params.set(
        "request",
        rawMessage
      );

      return NextResponse.json({
        mode:
          "new_request",
        requiresConfirmation:
          true,
        automaticExecutionAllowed:
          false,
        href:
          "/assistant/market?" +
          params.toString(),
      });
    }

    return NextResponse.json({
      mode:
        "no_action",
      automaticExecutionAllowed:
        false,
      href:
        "/assistant/actions",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Commande KLYX indisponible.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          apiErrorStatus(message),
      }
    );
  }
}
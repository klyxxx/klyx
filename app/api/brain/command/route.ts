import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  getBrainActions,
} from "@/lib/brain-actions";
import {
  bestBrainCommandAction,
  hasGeneralBrainCommandIntent,
  hasNewNeedBrainCommandIntent,
  hasSpecificBrainCommandIntent,
  normalizeBrainCommandMessage,
} from "@/lib/brain-command-intent";
import {
  isKlyxAssistantMessageTooLong,
} from "@/lib/klyx-assistant-message-limits";

// KLYX_TRUSTED_COMMAND_ROUTER_12_81

type CommandBody = {
  message?: string;
};

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
      isKlyxAssistantMessageTooLong(rawMessage)
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
      normalizeBrainCommandMessage(
        rawMessage
      );

    // IMPORTANT 12.81:
    // actions recalculated from DB server-side.
    const actions =
      (
        await getBrainActions(
          profile
        )
      ).slice(0, 20);

    const specificExistingIntent =
      hasSpecificBrainCommandIntent(
        message
      );

    const generalActionIntent =
      hasGeneralBrainCommandIntent(
        message
      );

    const newNeedIntent =
      hasNewNeedBrainCommandIntent(
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
        bestBrainCommandAction(
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

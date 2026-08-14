import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  normalizeMultiSlotSchedule,
} from "@/lib/brain-multi-slot-proof";

// KLYX_CONFIRM_REQUEST_MULTI_SLOT_12_83

type ConfirmedRequestInput = {
  serviceSlug?: string | null;
  city?: string | null;
  date?: string | null;
  time?: string | null;
  budget?: number | null;
  schedule?: unknown;
};

type ConfirmRequestBody = {
  conversationId?: string;
  request?: ConfirmedRequestInput;
};

type ConfirmationMessageRow = {
  id: string;
};

function clean(
  value:
    | string
    | null
    | undefined
) {
  return (
    value?.trim() ??
    ""
  );
}

function totalBudget(
  slots: ReturnType<
    typeof normalizeMultiSlotSchedule
  >
) {
  if (!slots) {
    return null;
  }

  if (
    !slots.every(
      (slot) =>
        slot.budget != null
    )
  ) {
    return null;
  }

  return (
    Math.round(
      slots.reduce(
        (total, slot) =>
          total +
          (
            slot.budget ??
            0
          ),
        0
      ) * 100
    ) / 100
  );
}

export async function POST(
  request: Request
) {
  try {
    const { profile } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const body =
      (await request.json()) as
        ConfirmRequestBody;

    const conversationId =
      clean(
        body.conversationId
      );

    if (!conversationId) {
      return NextResponse.json(
        {
          error:
            "Conversation KLYX manquante.",
        },
        {
          status: 400,
        }
      );
    }

    const serviceSlug =
      clean(
        body.request
          ?.serviceSlug
      );

    const city =
      clean(
        body.request?.city
      );

    const schedule =
      normalizeMultiSlotSchedule(
        body.request?.schedule
      );

    let date =
      clean(
        body.request?.date
      );

    let time =
      clean(
        body.request?.time
      );

    let requestBudget =
      body.request?.budget ==
        null
        ? null
        : Number(
            body.request
              .budget
          );

    if (schedule) {
      date =
        schedule[0].date;

      time =
        schedule[0]
          .startTime;

      requestBudget =
        totalBudget(
          schedule
        );
    }

    if (
      !serviceSlug ||
      !city ||
      !date ||
      !time
    ) {
      return NextResponse.json(
        {
          error:
            "La demande doit etre complete avant confirmation.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestBudget != null &&
      (
        !Number.isFinite(
          requestBudget
        ) ||
        requestBudget < 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Budget invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: conversation,
      error:
        conversationError,
    } = await supabaseAdmin
      .from(
        "brain_conversations"
      )
      .select("id")
      .eq(
        "id",
        conversationId
      )
      .eq(
        "user_id",
        profile.id
      )
      .maybeSingle();

    if (
      conversationError
    ) {
      throw new Error(
        conversationError
          .message
      );
    }

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation KLYX introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const confirmedAt =
      new Date()
        .toISOString();

    const confirmedRequest:
      Record<
        string,
        unknown
      > = {
        serviceSlug,
        city,
        date,
        time,
        budget:
          requestBudget,
      };

    if (schedule) {
      confirmedRequest.requestMode =
        "multi_slot";

      confirmedRequest.schedule = {
        multiSlot: true,
        slots:
          schedule,
      };
    }

    const confirmationPayload = {
      action:
        "confirm_request",
      confirmed: true,
      confirmedAt,
      request:
        confirmedRequest,
      nextStep:
        schedule
          ? "review_multi_slot_request"
          : "review_request",
      automaticExecutionAllowed:
        false,
    };

    const {
      data:
        confirmationMessage,
      error: messageError,
    } = await supabaseAdmin
      .from(
        "brain_messages"
      )
      .insert({
        conversation_id:
          conversationId,
        role: "user",
        content:
          schedule
            ? "Confirmation explicite de la demande KLYX multi-creneaux."
            : "Confirmation explicite de la demande KLYX.",
        payload:
          confirmationPayload,
      })
      .select("id")
      .single();

    if (messageError) {
      throw new Error(
        messageError.message
      );
    }

    const confirmationId =
      (
        confirmationMessage as
          ConfirmationMessageRow
      ).id;

    const { error: updateError } =
      await supabaseAdmin
        .from(
          "brain_conversations"
        )
        .update({
          updated_at:
            confirmedAt,
        })
        .eq(
          "id",
          conversationId
        )
        .eq(
          "user_id",
          profile.id
        );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    return NextResponse.json({
      confirmed: true,
      confirmationId,
      action:
        "confirm_request",
      confirmedAt,
      requestMode:
        schedule
          ? "multi_slot"
          : "single",
      nextStep:
        schedule
          ? "review_multi_slot_request"
          : "review_request",
      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Confirmation KLYX indisponible.";

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
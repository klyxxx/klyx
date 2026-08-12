import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

// KLYX_CONFIRM_REQUEST_API_12_63
// KLYX_CONFIRMATION_PROOF_12_64

type ConfirmedRequestInput = {
  serviceSlug?: string | null;
  city?: string | null;
  date?: string | null;
  time?: string | null;
  budget?: number | null;
};

type ConfirmRequestBody = {
  conversationId?: string;
  request?: ConfirmedRequestInput;
};

type ConfirmationMessageRow = {
  id: string;
};

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body =
      (await request.json()) as ConfirmRequestBody;

    const conversationId =
      cleanText(body.conversationId);

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation KLYX manquante." },
        { status: 400 }
      );
    }

    const serviceSlug =
      cleanText(body.request?.serviceSlug);

    const city =
      cleanText(body.request?.city);

    const date =
      cleanText(body.request?.date);

    const time =
      cleanText(body.request?.time);

    const budget =
      body.request?.budget == null
        ? null
        : Number(body.request.budget);

    if (!serviceSlug || !city || !date || !time) {
      return NextResponse.json(
        {
          error:
            "La demande doit être complète avant confirmation.",
        },
        { status: 400 }
      );
    }

    if (
      budget != null &&
      (!Number.isFinite(budget) || budget < 0)
    ) {
      return NextResponse.json(
        { error: "Budget invalide." },
        { status: 400 }
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await supabaseAdmin
      .from("brain_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation KLYX introuvable." },
        { status: 404 }
      );
    }

    const confirmedAt =
      new Date().toISOString();

    const confirmationPayload = {
      action: "confirm_request",
      confirmed: true,
      confirmedAt,
      request: {
        serviceSlug,
        city,
        date,
        time,
        budget,
      },
      nextStep: "review_request",
      automaticExecutionAllowed: false,
    };

    const {
      data: confirmationMessage,
      error: messageError,
    } = await supabaseAdmin
      .from("brain_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content:
          "Confirmation explicite de la demande KLYX.",
        payload: confirmationPayload,
      })
      .select("id")
      .single();

    if (messageError) {
      throw new Error(messageError.message);
    }

    const confirmationId =
      (confirmationMessage as ConfirmationMessageRow).id;

    const { error: updateError } =
      await supabaseAdmin
        .from("brain_conversations")
        .update({
          updated_at: confirmedAt,
        })
        .eq("id", conversationId)
        .eq("user_id", profile.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      confirmed: true,
      confirmationId,
      action: "confirm_request",
      confirmedAt,
      nextStep: "review_request",
      automaticExecutionAllowed: false,
    });
  } catch (error) {
    console.error(
      "KLYX confirm request error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Confirmation KLYX indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
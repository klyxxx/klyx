import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyCompatibleProviders } from "@/lib/market-notifications";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

function clean(
  value: unknown,
  max: number
): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

import { requireBrainMarketConfirmation } from "@/lib/brain-market-confirmation";

export async function POST(request: Request) {
  try {
    // KLYX_MARKET_CONFIRMATION_GATE_12_65
    const klyxConfirmationGateRequest =
      request.clone();

    const klyxConfirmationGateBody =
      await klyxConfirmationGateRequest.json();

    await requireBrainMarketConfirmation({
      request: request,
      body: klyxConfirmationGateBody,
    });

    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(
      profile,
      "client"
    );

    const body = (await request.json()) as {
      conversationId?: unknown;
      serviceSlug?: unknown;
      title?: unknown;
      description?: unknown;
      city?: unknown;
      requestedDate?: unknown;
      requestedTime?: unknown;
      budgetMax?: unknown;
      confirmed?: unknown;
    };

    if (body.confirmed !== true) {
      return NextResponse.json(
        {
          error:
            "La publication exige une confirmation explicite.",
        },
        { status: 400 }
      );
    }

    const serviceSlug = clean(
      body.serviceSlug,
      100
    );
    const title = clean(body.title, 120);
    const description = clean(
      body.description,
      2000
    );
    const city = clean(body.city, 100);

    const requestedDate =
      clean(body.requestedDate, 10) ||
      null;

    const requestedTime =
      clean(body.requestedTime, 5) ||
      null;

    const conversationId =
      clean(body.conversationId, 100) ||
      null;

    const budgetRaw =
      body.budgetMax === null ||
      body.budgetMax === undefined ||
      body.budgetMax === ""
        ? null
        : Number(body.budgetMax);

    const budgetMax =
      budgetRaw !== null &&
      Number.isFinite(budgetRaw) &&
      budgetRaw >= 0
        ? budgetRaw
        : null;

    if (
      !serviceSlug ||
      title.length < 3 ||
      description.length < 10 ||
      city.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Service, titre, description et ville sont requis.",
        },
        { status: 400 }
      );
    }

    const {
      data: service,
      error: serviceError,
    } = await supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .eq("slug", serviceSlug)
      .maybeSingle();

    if (serviceError) {
      throw new Error(
        serviceError.message
      );
    }

    if (!service) {
      return NextResponse.json(
        {
          error:
            "Le métier compris par KLYX n’existe pas dans le catalogue actif.",
        },
        { status: 404 }
      );
    }

    if (conversationId) {
      const {
        data: conversation,
        error: conversationError,
      } = await supabaseAdmin
        .from("brain_conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationError) {
        throw new Error(
          conversationError.message
        );
      }

      if (!conversation) {
        return NextResponse.json(
          {
            error:
              "Conversation KLYX introuvable.",
          },
          { status: 404 }
        );
      }
    }

    const {
      data: created,
      error: createError,
    } = await supabaseAdmin
      .from("market_service_requests")
      .insert({
        client_profile_id: profile.id,
        service_id: service.id,
        title,
        description,
        city,
        requested_date:
          requestedDate,
        requested_time:
          requestedTime
            ? `${requestedTime}:00`
            : null,
        budget_max: budgetMax,
        status: "open",
      })
      .select("id")
      .single();

    if (createError) {
      throw new Error(
        createError.message
      );
    }

    await notifyCompatibleProviders({
      marketRequestId: created.id,
      serviceId: service.id,
      serviceName:
        service.name?.trim() ||
        service.slug,
      city,
    });

    if (conversationId) {
      await supabaseAdmin
        .from("brain_messages")
        .insert({
          conversation_id:
            conversationId,
          role: "assistant",
          content:
            "Demande publiée après confirmation du client.",
          payload: {
            action:
              "market_request_published",
            marketRequestId:
              created.id,
          },
        });
    }

    return NextResponse.json({
      requestId: created.id,
      href: "/requests",
      message:
        "Demande publiée. Les prestataires compatibles vont être avertis.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de publier la demande.";

    return NextResponse.json(
      { error: message },
      {
        status:
          apiErrorStatus(message),
      }
    );
  }
}

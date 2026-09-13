import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import type { KlyxBusinessCostType } from "@/lib/klyx-business-metrics";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MANUAL_COST_TYPES = new Set<KlyxBusinessCostType>([
  "support",
  "fraud_dispute",
  "acquisition",
]);

const MANUAL_SOURCE_BY_COST_TYPE: Record<
  Exclude<KlyxBusinessCostType, "stripe_fee">,
  "support" | "fraud" | "acquisition"
> = {
  support: "support",
  fraud_dispute: "fraud",
  acquisition: "acquisition",
};

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as Record<string, unknown>;

    const costType = body.costType;
    const amountCents = Number(body.amountCents);
    const currency =
      typeof body.currency === "string"
        ? body.currency.trim().toUpperCase()
        : "EUR";
    const bookingId = cleanId(body.bookingId);
    const marketRequestId = cleanId(body.marketRequestId);
    let serviceId = cleanId(body.serviceId);
    const manualReference = cleanId(body.sourceKey)?.slice(0, 200) ?? null;
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 1000)
        : null;
    const occurredAt =
      typeof body.occurredAt === "string" && body.occurredAt.trim()
        ? new Date(body.occurredAt)
        : new Date();

    if (
      typeof costType !== "string" ||
      !MANUAL_COST_TYPES.has(costType as KlyxBusinessCostType)
    ) {
      return NextResponse.json(
        {
          error:
            "Type de coût manuel invalide. Les frais Stripe doivent être synchronisés depuis Stripe.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: "Le coût doit être un entier strictement positif en centimes." },
        { status: 400 }
      );
    }

    if (!manualReference) {
      return NextResponse.json(
        {
          error:
            "Une référence unique est obligatoire pour empêcher de compter deux fois le même coût.",
        },
        { status: 400 }
      );
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        { error: "Devise invalide." },
        { status: 400 }
      );
    }

    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json(
        { error: "Date du coût invalide." },
        { status: 400 }
      );
    }

    if (bookingId && marketRequestId) {
      return NextResponse.json(
        {
          error:
            "Attribuez le coût à une réservation ou à une demande, pas aux deux à la fois.",
        },
        { status: 400 }
      );
    }

    if (!serviceId && !bookingId && !marketRequestId) {
      return NextResponse.json(
        {
          error:
            "Le coût doit être attribué à un service, une réservation ou une demande réelle.",
        },
        { status: 400 }
      );
    }

    if (bookingId) {
      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select("id, service_id")
        .eq("id", bookingId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!booking) {
        return NextResponse.json(
          { error: "Réservation introuvable." },
          { status: 404 }
        );
      }
      if (serviceId && booking.service_id && serviceId !== booking.service_id) {
        return NextResponse.json(
          { error: "Le service ne correspond pas à la réservation." },
          { status: 409 }
        );
      }
      serviceId = serviceId ?? booking.service_id;
    }

    if (marketRequestId) {
      const { data: marketRequest, error } = await supabaseAdmin
        .from("market_service_requests")
        .select("id, service_id")
        .eq("id", marketRequestId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!marketRequest) {
        return NextResponse.json(
          { error: "Demande KLYX introuvable." },
          { status: 404 }
        );
      }
      if (serviceId && serviceId !== marketRequest.service_id) {
        return NextResponse.json(
          { error: "Le service ne correspond pas à la demande." },
          { status: 409 }
        );
      }
      serviceId = serviceId ?? marketRequest.service_id;
    }

    if (!serviceId) {
      return NextResponse.json(
        { error: "Impossible d'attribuer ce coût à une catégorie." },
        { status: 409 }
      );
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", serviceId)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    if (!service) {
      return NextResponse.json(
        { error: "Service KLYX introuvable." },
        { status: 404 }
      );
    }

    const manualCostType = costType as Exclude<
      KlyxBusinessCostType,
      "stripe_fee"
    >;
    const source = MANUAL_SOURCE_BY_COST_TYPE[manualCostType];
    const sourceKey = `manual:${manualCostType}:${manualReference}`;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("business_cost_events")
      .insert({
        cost_type: manualCostType,
        amount_cents: amountCents,
        currency,
        service_id: serviceId,
        booking_id: bookingId,
        market_request_id: marketRequestId,
        source,
        source_key: sourceKey,
        note,
        occurred_at: occurredAt.toISOString(),
        created_by: founder.id,
      })
      .select(
        "id, cost_type, amount_cents, currency, service_id, booking_id, market_request_id, occurred_at"
      )
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Cette référence de coût a déjà été enregistrée." },
          { status: 409 }
        );
      }
      throw new Error(insertError.message);
    }

    const { error: trackingError } = await supabaseAdmin
      .from("business_cost_tracking_state")
      .update({
        tracking_mode: "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("cost_type", manualCostType)
      .eq("tracking_mode", "unavailable");
    if (trackingError) throw new Error(trackingError.message);

    return NextResponse.json(
      { cost: inserted, synthetic: false },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_business_cost_create_failed",
      route: "/api/founder/business-costs",
      method: "POST",
      status,
      code: "KLYX_FOUNDER_BUSINESS_COST_CREATE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

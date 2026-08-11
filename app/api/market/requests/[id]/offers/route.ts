import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { id: requestId } = await context.params;
    const body = (await request.json()) as {
      amount?: unknown;
      message?: unknown;
    };

    const amount = Number(body.amount);
    const message = clean(body.message, 1500);

    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const { data: serviceRequest, error: requestError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, service_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);
    if (!serviceRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (serviceRequest.status !== "open") {
      return NextResponse.json({ error: "Cette demande n’accepte plus d’offres." }, { status: 409 });
    }

    const { data: userService, error: userServiceError } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", profile.id)
      .eq("service_id", serviceRequest.service_id)
      .eq("active", true)
      .eq("provider_enabled", true)
      .maybeSingle();

    if (userServiceError) throw new Error(userServiceError.message);
    if (!userService) {
      return NextResponse.json(
        { error: "Tu ne proposes pas ce métier sur ton profil actif." },
        { status: 403 }
      );
    }

    const { data: offer, error } = await supabaseAdmin
      .from("market_service_offers")
      .upsert(
        {
          request_id: requestId,
          provider_profile_id: profile.id,
          user_service_id: userService.id,
          amount,
          message: message || null,
          status: "sent",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id,provider_profile_id" }
      )
      .select("id, request_id, amount, message, status, created_at, updated_at")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      offer,
      message: "Offre envoyée au client.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible d’envoyer l’offre.";

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
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: requestId } = await context.params;
    const body = (await request.json()) as {
      offerId?: unknown;
      action?: unknown;
    };

    const offerId = clean(body.offerId, 80);
    const action = clean(body.action, 20);

    if (!offerId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    }

    const { data: serviceRequest, error: requestError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, client_profile_id, status")
      .eq("id", requestId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);
    if (!serviceRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (serviceRequest.status !== "open") {
      return NextResponse.json({ error: "Cette demande n’est plus ouverte." }, { status: 409 });
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("market_service_offers")
      .select("id, status")
      .eq("id", offerId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (offerError) throw new Error(offerError.message);
    if (!offer) {
      return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "reject") {
      const { error } = await supabaseAdmin
        .from("market_service_offers")
        .update({ status: "rejected", updated_at: now })
        .eq("id", offerId)
        .eq("request_id", requestId);

      if (error) throw new Error(error.message);

      return NextResponse.json({ message: "Offre refusée." });
    }

    const { error: acceptedError } = await supabaseAdmin
      .from("market_service_offers")
      .update({ status: "accepted", updated_at: now })
      .eq("id", offerId)
      .eq("request_id", requestId);

    if (acceptedError) throw new Error(acceptedError.message);

    const { error: rejectOthersError } = await supabaseAdmin
      .from("market_service_offers")
      .update({ status: "rejected", updated_at: now })
      .eq("request_id", requestId)
      .neq("id", offerId)
      .eq("status", "sent");

    if (rejectOthersError) throw new Error(rejectOthersError.message);

    const { error: requestUpdateError } = await supabaseAdmin
      .from("market_service_requests")
      .update({
        status: "matched",
        accepted_offer_id: offerId,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("client_profile_id", profile.id);

    if (requestUpdateError) throw new Error(requestUpdateError.message);

    return NextResponse.json({
      message:
        "Offre acceptée. La demande est maintenant attribuée. La réservation finale reste une étape séparée.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de modifier l’offre.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

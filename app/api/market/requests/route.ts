import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType === "client") {
      const { data: requests, error } = await supabaseAdmin
        .from("market_service_requests")
        .select(
          "id, client_profile_id, service_id, title, description, city, requested_date, requested_time, budget_max, status, accepted_offer_id, created_at, updated_at"
        )
        .eq("client_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      const requestIds = (requests ?? []).map((item) => item.id);
      const serviceIds = [...new Set((requests ?? []).map((item) => item.service_id))];

      const [{ data: offers, error: offerError }, { data: services, error: serviceError }] =
        await Promise.all([
          requestIds.length
            ? supabaseAdmin
                .from("market_service_offers")
                .select(
                  "id, request_id, provider_profile_id, amount, message, status, created_at"
                )
                .in("request_id", requestIds)
                .order("amount", { ascending: true })
            : Promise.resolve({ data: [], error: null }),
          serviceIds.length
            ? supabaseAdmin
                .from("services")
                .select("id, name, slug")
                .in("id", serviceIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (offerError) throw new Error(offerError.message);
      if (serviceError) throw new Error(serviceError.message);

      const providerIds = [...new Set((offers ?? []).map((offer) => offer.provider_profile_id))];
      const { data: providers, error: providerError } = providerIds.length
        ? await supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .in("id", providerIds)
        : { data: [], error: null };

      if (providerError) throw new Error(providerError.message);

      const serviceMap = new Map((services ?? []).map((item) => [item.id, item]));
      const providerMap = new Map((providers ?? []).map((item) => [item.id, item]));

      return NextResponse.json({
        role: "client",
        requests: (requests ?? []).map((item) => ({
          ...item,
          service: serviceMap.get(item.service_id) ?? null,
          offers: (offers ?? [])
            .filter((offer) => offer.request_id === item.id)
            .map((offer) => ({
              ...offer,
              provider: providerMap.get(offer.provider_profile_id) ?? null,
            })),
        })),
      });
    }

    requireAccountType(profile, "provider");

    const { data: providerServices, error: providerServiceError } =
      await supabaseAdmin
        .from("user_services")
        .select("id, service_id")
        .eq("user_id", profile.id)
        .eq("active", true)
        .eq("provider_enabled", true);

    if (providerServiceError) throw new Error(providerServiceError.message);

    const serviceIds = [...new Set((providerServices ?? []).map((item) => item.service_id))];

    if (serviceIds.length === 0) {
      return NextResponse.json({ role: "provider", requests: [] });
    }

    const { data: requests, error } = await supabaseAdmin
      .from("market_service_requests")
      .select(
        "id, client_profile_id, service_id, title, description, city, requested_date, requested_time, budget_max, status, created_at"
      )
      .eq("status", "open")
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const requestIds = (requests ?? []).map((item) => item.id);

    const [{ data: services, error: serviceError }, { data: offers, error: offerError }] =
      await Promise.all([
        supabaseAdmin.from("services").select("id, name, slug").in("id", serviceIds),
        requestIds.length
          ? supabaseAdmin
              .from("market_service_offers")
              .select("id, request_id, amount, message, status, created_at")
              .eq("provider_profile_id", profile.id)
              .in("request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (serviceError) throw new Error(serviceError.message);
    if (offerError) throw new Error(offerError.message);

    const serviceMap = new Map((services ?? []).map((item) => [item.id, item]));
    const offerMap = new Map((offers ?? []).map((item) => [item.request_id, item]));

    return NextResponse.json({
      role: "provider",
      requests: (requests ?? []).map((item) => ({
        ...item,
        service: serviceMap.get(item.service_id) ?? null,
        myOffer: offerMap.get(item.id) ?? null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de charger les demandes.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      serviceSlug?: unknown;
      title?: unknown;
      description?: unknown;
      city?: unknown;
      requestedDate?: unknown;
      requestedTime?: unknown;
      budgetMax?: unknown;
    };

    const serviceSlug = clean(body.serviceSlug, 100);
    const title = clean(body.title, 120);
    const description = clean(body.description, 2000);
    const city = clean(body.city, 100);
    const requestedDate = clean(body.requestedDate, 10) || null;
    const requestedTime = clean(body.requestedTime, 5) || null;

    const budgetRaw =
      body.budgetMax === null || body.budgetMax === undefined || body.budgetMax === ""
        ? null
        : Number(body.budgetMax);

    const budgetMax =
      budgetRaw !== null && Number.isFinite(budgetRaw) && budgetRaw >= 0
        ? budgetRaw
        : null;

    if (!serviceSlug || title.length < 3 || description.length < 10 || city.length < 2) {
      return NextResponse.json(
        { error: "Service, titre, description et ville sont requis." },
        { status: 400 }
      );
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .eq("slug", serviceSlug)
      .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);
    if (!service) {
      return NextResponse.json({ error: "Service introuvable." }, { status: 404 });
    }

    const { data: created, error } = await supabaseAdmin
      .from("market_service_requests")
      .insert({
        client_profile_id: profile.id,
        service_id: service.id,
        title,
        description,
        city,
        requested_date: requestedDate,
        requested_time: requestedTime ? `${requestedTime}:00` : null,
        budget_max: budgetMax,
        status: "open",
      })
      .select(
        "id, title, description, city, requested_date, requested_time, budget_max, status, created_at"
      )
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      request: created,
      message: "Demande publiée. Les prestataires compatibles peuvent maintenant proposer leur prix.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de publier la demande.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      requestId?: unknown;
      action?: unknown;
    };

    const requestId = clean(body.requestId, 80);
    const action = clean(body.action, 30);

    if (!requestId || action !== "cancel") {
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, status")
      .eq("id", requestId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (!existing) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    if (existing.status !== "open") {
      return NextResponse.json({ error: "Cette demande ne peut plus être annulée." }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from("market_service_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("client_profile_id", profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: "Demande annulée." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de modifier la demande.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { KLYX_LOCAL_VALUE_PILOT } from "@/lib/klyx-local-value-pilot";
import { supabaseAdmin } from "@/lib/supabase-admin";

function cleanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function isBrussels(value: string | null | undefined): boolean {
  const city = normalizeCity(value);
  return city === "bruxelles" || city === "brussels";
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validTime(value: string | null): boolean {
  return value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function pilotServiceId(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("slug", KLYX_LOCAL_VALUE_PILOT.serviceSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("KLYX_LOCAL_PILOT_SERVICE_MISSING");
  return data.id;
}

async function enrollRequest(
  founderId: string,
  body: Record<string, unknown>
) {
  const marketRequestId = cleanId(body.marketRequestId);
  const confirmedZone = body.confirmedZone === true;
  const confirmedService = body.confirmedService === true;
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : null;

  if (!marketRequestId || !confirmedZone || !confirmedService) {
    return NextResponse.json(
      {
        error:
          "Une vraie demande, la vérification Anneessens et la vérification du service sont obligatoires.",
      },
      { status: 400 }
    );
  }

  const serviceId = await pilotServiceId();
  const { data: marketRequest, error: requestError } = await supabaseAdmin
    .from("market_service_requests")
    .select("id, service_id, city")
    .eq("id", marketRequestId)
    .maybeSingle();
  if (requestError) throw new Error(requestError.message);
  if (!marketRequest) {
    return NextResponse.json(
      { error: "Demande KLYX introuvable." },
      { status: 404 }
    );
  }

  if (marketRequest.service_id !== serviceId) {
    return NextResponse.json(
      {
        error: `Le pilote accepte uniquement ${KLYX_LOCAL_VALUE_PILOT.serviceName}.`,
      },
      { status: 409 }
    );
  }

  if (!isBrussels(marketRequest.city)) {
    return NextResponse.json(
      { error: "La demande n'est pas localisée à Bruxelles." },
      { status: 409 }
    );
  }

  const { count, error: countError } = await supabaseAdmin
    .from("business_pilot_requests")
    .select("id", { count: "exact", head: true })
    .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) >= KLYX_LOCAL_VALUE_PILOT.maxRealRequests) {
    return NextResponse.json(
      {
        error:
          "Le plafond de demandes réelles du pilote est atteint. Aucun élargissement automatique n'est autorisé.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("business_pilot_requests")
    .insert({
      pilot_key: KLYX_LOCAL_VALUE_PILOT.key,
      market_request_id: marketRequestId,
      zone_verified: true,
      service_verified: true,
      note,
      enrolled_by: founderId,
    })
    .select("id, market_request_id, enrolled_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Cette demande appartient déjà au pilote." },
        { status: 409 }
      );
    }
    throw new Error(error.message);
  }

  return NextResponse.json(
    {
      enrollment: data,
      pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
      synthetic: false,
      preciseAddressStored: false,
    },
    { status: 201 }
  );
}

async function enrollIncomeAttempt(
  founderId: string,
  body: Record<string, unknown>
) {
  const marketOfferId = cleanId(body.marketOfferId);
  const incomeGoalCents = Number(body.incomeGoalCents);
  const currency =
    typeof body.currency === "string"
      ? body.currency.trim().toUpperCase()
      : KLYX_LOCAL_VALUE_PILOT.currency;
  const confirmedAvailability = body.confirmedAvailability === true;
  const confirmedIncomeGoal = body.confirmedIncomeGoal === true;
  const availabilityDate =
    typeof body.availabilityDate === "string" && body.availabilityDate.trim()
      ? body.availabilityDate.trim()
      : null;
  const availabilityStart =
    typeof body.availabilityStart === "string" && body.availabilityStart.trim()
      ? body.availabilityStart.trim().slice(0, 5)
      : null;
  const availabilityEnd =
    typeof body.availabilityEnd === "string" && body.availabilityEnd.trim()
      ? body.availabilityEnd.trim().slice(0, 5)
      : null;
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : null;

  if (
    !marketOfferId ||
    !confirmedAvailability ||
    !confirmedIncomeGoal ||
    !Number.isInteger(incomeGoalCents) ||
    incomeGoalCents <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Une vraie offre, une disponibilité vérifiée et un objectif de revenu réel sont obligatoires.",
      },
      { status: 400 }
    );
  }

  if (!validDate(availabilityDate)) {
    return NextResponse.json(
      {
        error:
          "Une date de disponibilité réelle au format AAAA-MM-JJ est obligatoire.",
      },
      { status: 400 }
    );
  }

  if (currency !== KLYX_LOCAL_VALUE_PILOT.currency) {
    return NextResponse.json(
      { error: "Le pilote local utilise uniquement EUR." },
      { status: 409 }
    );
  }

  if (!validTime(availabilityStart) || !validTime(availabilityEnd)) {
    return NextResponse.json(
      { error: "Fenêtre de disponibilité invalide." },
      { status: 400 }
    );
  }

  if (
    availabilityStart &&
    availabilityEnd &&
    availabilityEnd <= availabilityStart
  ) {
    return NextResponse.json(
      { error: "La fin de disponibilité doit être après le début." },
      { status: 400 }
    );
  }

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("market_service_offers")
    .select("id, request_id, provider_profile_id")
    .eq("id", marketOfferId)
    .maybeSingle();
  if (offerError) throw new Error(offerError.message);
  if (!offer) {
    return NextResponse.json(
      { error: "Offre KLYX introuvable." },
      { status: 404 }
    );
  }

  const { data: pilotRequest, error: pilotRequestError } = await supabaseAdmin
    .from("business_pilot_requests")
    .select("id, zone_verified, service_verified")
    .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key)
    .eq("market_request_id", offer.request_id)
    .eq("zone_verified", true)
    .eq("service_verified", true)
    .maybeSingle();
  if (pilotRequestError) throw new Error(pilotRequestError.message);
  if (!pilotRequest) {
    return NextResponse.json(
      {
        error:
          "L'offre doit viser une demande réelle déjà vérifiée dans le pilote.",
      },
      { status: 409 }
    );
  }

  const { data: existingProviders, error: providersError } = await supabaseAdmin
    .from("business_pilot_income_attempts")
    .select("provider_profile_id")
    .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key);
  if (providersError) throw new Error(providersError.message);

  const providerIds = new Set(
    (existingProviders ?? []).map((row) => row.provider_profile_id)
  );
  if (
    !providerIds.has(offer.provider_profile_id) &&
    providerIds.size >= KLYX_LOCAL_VALUE_PILOT.maxActiveProviders
  ) {
    return NextResponse.json(
      {
        error:
          "Le plafond de prestataires du pilote est atteint. Aucun élargissement automatique n'est autorisé.",
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("business_pilot_income_attempts")
    .insert({
      pilot_key: KLYX_LOCAL_VALUE_PILOT.key,
      provider_profile_id: offer.provider_profile_id,
      market_offer_id: offer.id,
      income_goal_cents: incomeGoalCents,
      currency,
      availability_date: availabilityDate,
      availability_start: availabilityStart,
      availability_end: availabilityEnd,
      availability_verified: true,
      income_goal_verified: true,
      note,
      enrolled_by: founderId,
    })
    .select(
      "id, provider_profile_id, market_offer_id, income_goal_cents, currency, enrolled_at"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Cette offre est déjà suivie dans la boucle revenu." },
        { status: 409 }
      );
    }
    throw new Error(error.message);
  }

  return NextResponse.json(
    {
      incomeAttempt: data,
      pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
      synthetic: false,
    },
    { status: 201 }
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "enroll_request") {
      return await enrollRequest(founder.id, body);
    }

    if (action === "enroll_income_attempt") {
      return await enrollIncomeAttempt(founder.id, body);
    }

    return NextResponse.json(
      { error: "Action pilote inconnue." },
      { status: 400 }
    );
  } catch (error) {
    const status = founderErrorStatus(error);
    return secureApiErrorResponse({
      error,
      event: "founder_business_pilot_update_failed",
      route: "/api/founder/business-pilot",
      method: "POST",
      status,
      code: "KLYX_FOUNDER_BUSINESS_PILOT_UPDATE_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}

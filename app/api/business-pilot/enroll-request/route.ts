import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { KLYX_LOCAL_VALUE_PILOT } from "@/lib/klyx-local-value-pilot";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
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

function capReachedResponse() {
  return NextResponse.json(
    {
      error:
        "Le plafond de 20 demandes réelles du pilote est atteint. La demande reste publiée hors cohorte pilote.",
    },
    { status: 409, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { user, profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as Record<string, unknown>;
    const marketRequestId = cleanId(body.marketRequestId);
    const confirmedZone = body.confirmedZone === true;
    const confirmedService = body.confirmedService === true;

    if (!marketRequestId || !confirmedZone || !confirmedService) {
      return NextResponse.json(
        {
          error:
            "La demande réelle et les confirmations explicites Anneessens + Montage de meubles sont obligatoires.",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: pilotService, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("slug", KLYX_LOCAL_VALUE_PILOT.serviceSlug)
      .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);
    if (!pilotService) throw new Error("KLYX_LOCAL_PILOT_SERVICE_MISSING");

    const { data: marketRequest, error: requestError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, client_profile_id, service_id, city")
      .eq("id", marketRequestId)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);
    if (!marketRequest || marketRequest.client_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Demande KLYX introuvable." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (marketRequest.service_id !== pilotService.id) {
      return NextResponse.json(
        {
          error: `Le pilote accepte uniquement ${KLYX_LOCAL_VALUE_PILOT.serviceName}.`,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isBrussels(marketRequest.city)) {
      return NextResponse.json(
        { error: "Le pilote local accepte uniquement les demandes à Bruxelles." },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("business_pilot_requests")
      .select("id, market_request_id, enrolled_at")
      .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key)
      .eq("market_request_id", marketRequestId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return NextResponse.json(
        {
          enrolled: true,
          replayed: true,
          enrollment: existing,
          pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
          evidenceSource: "client_explicit_confirmation",
          preciseAddressStored: false,
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const { count, error: countError } = await supabaseAdmin
      .from("business_pilot_requests")
      .select("id", { count: "exact", head: true })
      .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key);

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= KLYX_LOCAL_VALUE_PILOT.maxRealRequests) {
      return capReachedResponse();
    }

    const { data: enrollment, error: insertError } = await supabaseAdmin
      .from("business_pilot_requests")
      .insert({
        pilot_key: KLYX_LOCAL_VALUE_PILOT.key,
        market_request_id: marketRequestId,
        zone_verified: true,
        service_verified: true,
        note: "client_explicit_confirmation: anneessens + furniture_assembly",
        enrolled_by: user.id,
      })
      .select("id, market_request_id, enrolled_at")
      .single();

    if (insertError) {
      if (
        insertError.code === "23514" &&
        insertError.message.includes("KLYX_BUSINESS_PILOT_REQUEST_CAP_REACHED")
      ) {
        return capReachedResponse();
      }

      if (insertError.code === "23505") {
        const { data: raced, error: racedError } = await supabaseAdmin
          .from("business_pilot_requests")
          .select("id, market_request_id, enrolled_at")
          .eq("pilot_key", KLYX_LOCAL_VALUE_PILOT.key)
          .eq("market_request_id", marketRequestId)
          .maybeSingle();

        if (racedError) throw new Error(racedError.message);
        if (raced) {
          return NextResponse.json(
            {
              enrolled: true,
              replayed: true,
              enrollment: raced,
              pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
              evidenceSource: "client_explicit_confirmation",
              preciseAddressStored: false,
            },
            { headers: { "Cache-Control": "private, no-store, max-age=0" } }
          );
        }
      }

      throw new Error(insertError.message);
    }

    return NextResponse.json(
      {
        enrolled: true,
        replayed: false,
        enrollment,
        pilotKey: KLYX_LOCAL_VALUE_PILOT.key,
        evidenceSource: "client_explicit_confirmation",
        preciseAddressStored: false,
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enrôlement pilote indisponible.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "business_pilot_client_enroll_failed",
      route: "/api/business-pilot/enroll-request",
      method: "POST",
      status,
      code: "KLYX_BUSINESS_PILOT_CLIENT_ENROLL_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

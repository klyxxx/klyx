// KLYX_MARKET_TRANSACTION_CURRENCY_API_PHASE_5C
import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { calculateClientOfferRanking } from "@/lib/client-offer-ranking";
import { notifyCompatibleProviders } from "@/lib/market-notifications";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SAFE_MARKET_AUTH_MESSAGES = new Set([
  "Session manquante.",
  "Session invalide.",
  "Profil KLYX introuvable.",
  "Cette action nécessite un profil prestataire.",
  "Cette action nécessite un profil client.",
]);

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function secureMarketRequestError(
  error: unknown,
  method: "GET" | "POST" | "PATCH",
  event: string,
  code: string,
  startedAt: number
) {
  const message =
    error instanceof Error
      ? error.message
      : "Opération marché impossible.";
  const status = apiErrorStatus(message);

  return secureApiErrorResponse({
    error,
    event,
    route: "/api/market/requests",
    method,
    status,
    code,
    publicMessage:
      status < 500 && SAFE_MARKET_AUTH_MESSAGES.has(message)
        ? message
        : undefined,
    startedAt,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);

    if (profile.accountType === "client") {
      const { data: requests, error } = await supabaseAdmin
        .from("market_service_requests")
        .select(
          "id, client_profile_id, service_id, title, description, city, requested_date, requested_time, budget_max, country_code, currency, status, accepted_offer_id, created_at, updated_at"
        )
        .eq("client_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const requestIds = (requests ?? []).map((item) => item.id);
      const serviceIds = [
        ...new Set((requests ?? []).map((item) => item.service_id)),
      ];

      const [
        { data: offers, error: offerError },
        { data: services, error: serviceError },
        { data: linkedQuotes, error: linkedQuoteError },
      ] = await Promise.all([
        requestIds.length
          ? supabaseAdmin
              .from("market_service_offers")
              .select(
                "id, request_id, provider_profile_id, user_service_id, amount, country_code, currency, message, status, created_at"
              )
              .in("request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
        serviceIds.length
          ? supabaseAdmin
              .from("services")
              .select("id, name, slug")
              .in("id", serviceIds)
          : Promise.resolve({ data: [], error: null }),
        requestIds.length
          ? supabaseAdmin
              .from("service_quotes")
              .select("id, market_request_id, status")
              .in("market_request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (offerError) throw offerError;
      if (serviceError) throw serviceError;
      if (linkedQuoteError) throw linkedQuoteError;

      const providerIds = [
        ...new Set(
          (offers ?? []).map((offer) => offer.provider_profile_id)
        ),
      ];
      const userServiceIds = [
        ...new Set((offers ?? []).map((offer) => offer.user_service_id)),
      ];

      const [
        { data: providers, error: providerError },
        { data: providerProfiles, error: providerProfileError },
        { data: serviceProfiles, error: serviceProfileError },
      ] = await Promise.all([
        providerIds.length
          ? supabaseAdmin
              .from("profiles")
              .select("id, first_name, last_name, avatar_url")
              .in("id", providerIds)
          : Promise.resolve({ data: [], error: null }),
        providerIds.length
          ? supabaseAdmin
              .from("provider_profiles")
              .select(
                "profile_id, years_experience, verification_status"
              )
              .in("profile_id", providerIds)
          : Promise.resolve({ data: [], error: null }),
        userServiceIds.length
          ? supabaseAdmin
              .from("service_profiles")
              .select(
                "user_service_id, klyx_score, rating, review_count"
              )
              .in("user_service_id", userServiceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (providerError) throw providerError;
      if (providerProfileError) throw providerProfileError;
      if (serviceProfileError) throw serviceProfileError;

      const serviceMap = new Map(
        (services ?? []).map((item) => [item.id, item])
      );
      const providerMap = new Map(
        (providers ?? []).map((item) => [item.id, item])
      );
      const providerProfileMap = new Map(
        (providerProfiles ?? []).map((item) => [item.profile_id, item])
      );
      const serviceProfileMap = new Map(
        (serviceProfiles ?? []).map((item) => [
          item.user_service_id,
          item,
        ])
      );
      const quoteMap = new Map(
        (linkedQuotes ?? []).map((item) => [
          item.market_request_id,
          item,
        ])
      );

      return NextResponse.json({
        role: "client",
        requests: (requests ?? []).map((item) => {
          const rankedOffers = (offers ?? [])
            .filter((offer) => offer.request_id === item.id)
            .map((offer) => {
              const provider =
                providerMap.get(offer.provider_profile_id) ?? null;
              const providerProfile =
                providerProfileMap.get(offer.provider_profile_id) ?? null;
              const serviceProfile =
                serviceProfileMap.get(offer.user_service_id) ?? null;

              const ranking = calculateClientOfferRanking({
                amount: Number(offer.amount),
                budgetMax:
                  item.budget_max === null
                    ? null
                    : Number(item.budget_max),
                klyxScore: Number(serviceProfile?.klyx_score ?? 50),
                rating: Number(serviceProfile?.rating ?? 0),
                reviewCount: Number(serviceProfile?.review_count ?? 0),
                yearsExperience: Number(
                  providerProfile?.years_experience ?? 0
                ),
                isVerified:
                  providerProfile?.verification_status === "verified",
              });

              return {
                ...offer,
                provider,
                providerStats: {
                  klyxScore: Number(serviceProfile?.klyx_score ?? 50),
                  rating: Number(serviceProfile?.rating ?? 0),
                  reviewCount: Number(serviceProfile?.review_count ?? 0),
                  yearsExperience: Number(
                    providerProfile?.years_experience ?? 0
                  ),
                  isVerified:
                    providerProfile?.verification_status === "verified",
                },
                ranking,
              };
            })
            .sort((first, second) => {
              if (first.ranking.score !== second.ranking.score) {
                return second.ranking.score - first.ranking.score;
              }
              return Number(first.amount) - Number(second.amount);
            })
            .map((offer, index) => ({
              ...offer,
              isRecommended: index === 0,
              isCheapest: false,
            }));

          if (rankedOffers.length > 0) {
            const cheapestAmount = Math.min(
              ...rankedOffers.map((offer) => Number(offer.amount))
            );
            for (const offer of rankedOffers) {
              offer.isCheapest = Number(offer.amount) === cheapestAmount;
            }
          }

          return {
            ...item,
            service: serviceMap.get(item.service_id) ?? null,
            bookingQuote: quoteMap.get(item.id) ?? null,
            offers: rankedOffers,
          };
        }),
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

    if (providerServiceError) throw providerServiceError;

    const serviceIds = [
      ...new Set(
        (providerServices ?? []).map((item) => item.service_id)
      ),
    ];

    if (serviceIds.length === 0) {
      return NextResponse.json({
        role: "provider",
        requests: [],
      });
    }

    const { data: requests, error } = await supabaseAdmin
      .from("market_service_requests")
      .select(
        "id, client_profile_id, service_id, title, description, city, requested_date, requested_time, budget_max, country_code, currency, status, created_at"
      )
      .eq("status", "open")
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const requestIds = (requests ?? []).map((item) => item.id);

    const [
      { data: services, error: serviceError },
      { data: offers, error: offerError },
    ] = await Promise.all([
      supabaseAdmin
        .from("services")
        .select("id, name, slug")
        .in("id", serviceIds),
      requestIds.length
        ? supabaseAdmin
            .from("market_service_offers")
            .select(
              "id, request_id, amount, country_code, currency, message, status, created_at"
            )
            .eq("provider_profile_id", profile.id)
            .in("request_id", requestIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (serviceError) throw serviceError;
    if (offerError) throw offerError;

    const serviceMap = new Map(
      (services ?? []).map((item) => [item.id, item])
    );
    const offerMap = new Map(
      (offers ?? []).map((item) => [item.request_id, item])
    );

    return NextResponse.json({
      role: "provider",
      requests: (requests ?? []).map((item) => ({
        ...item,
        service: serviceMap.get(item.service_id) ?? null,
        myOffer: offerMap.get(item.id) ?? null,
      })),
    });
  } catch (error) {
    return secureMarketRequestError(
      error,
      "GET",
      "market_requests_load_failed",
      "KLYX_MARKET_REQUESTS_LOAD_FAILED",
      startedAt
    );
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    let body: {
      serviceSlug?: unknown;
      title?: unknown;
      description?: unknown;
      city?: unknown;
      requestedDate?: unknown;
      requestedTime?: unknown;
      budgetMax?: unknown;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 }
      );
    }

    const serviceSlug = clean(body.serviceSlug, 100);
    const title = clean(body.title, 120);
    const description = clean(body.description, 2000);
    const city = clean(body.city, 100);
    const requestedDate = clean(body.requestedDate, 10) || null;
    const requestedTime = clean(body.requestedTime, 5) || null;

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

    const marketCountry = profile.countryCode.trim().toUpperCase();
    const marketCurrency = profile.currencyCode.trim().toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(marketCountry) ||
      !/^[A-Z]{3}$/.test(marketCurrency)
    ) {
      return NextResponse.json(
        {
          error:
            "Configure ton pays et ta devise KLYX avant de publier une demande.",
          code: "KLYX_PROFILE_MARKET_REQUIRED",
        },
        { status: 409 }
      );
    }

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

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .eq("slug", serviceSlug)
      .maybeSingle();

    if (serviceError) throw serviceError;

    if (!service) {
      return NextResponse.json(
        { error: "Service introuvable." },
        { status: 404 }
      );
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
        country_code: marketCountry,
        currency: marketCurrency,
        status: "open",
      })
      .select(
        "id, title, description, city, requested_date, requested_time, budget_max, country_code, currency, status, created_at"
      )
      .single();

    if (error) throw error;

    await notifyCompatibleProviders({
      marketRequestId: created.id,
      serviceId: service.id,
      serviceName: service.name?.trim() || service.slug,
      city,
    });

    return NextResponse.json({
      request: created,
      message:
        "Demande publiée. Les prestataires compatibles peuvent maintenant proposer leur prix.",
    });
  } catch (error) {
    return secureMarketRequestError(
      error,
      "POST",
      "market_request_create_failed",
      "KLYX_MARKET_REQUEST_CREATE_FAILED",
      startedAt
    );
  }
}

export async function PATCH(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    let body: {
      requestId?: unknown;
      action?: unknown;
    };

    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 }
      );
    }

    const requestId = clean(body.requestId, 80);
    const action = clean(body.action, 30);

    if (!requestId || action !== "cancel") {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("market_service_requests")
      .select("id, status")
      .eq("id", requestId)
      .eq("client_profile_id", profile.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { error: "Demande introuvable." },
        { status: 404 }
      );
    }

    if (existing.status !== "open") {
      return NextResponse.json(
        { error: "Cette demande ne peut plus être annulée." },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from("market_service_requests")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("client_profile_id", profile.id);

    if (error) throw error;

    return NextResponse.json({
      message: "Demande annulée.",
    });
  } catch (error) {
    return secureMarketRequestError(
      error,
      "PATCH",
      "market_request_update_failed",
      "KLYX_MARKET_REQUEST_UPDATE_FAILED",
      startedAt
    );
  }
}

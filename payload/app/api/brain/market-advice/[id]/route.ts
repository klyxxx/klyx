import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculateClientOfferRanking } from "@/lib/client-offer-ranking";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

type OfferRow = {
  id: string;
  provider_profile_id: string;
  user_service_id: string;
  amount: number;
  message: string | null;
  status: string;
};

function providerName(
  firstName: string | null,
  lastName: string | null
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Prestataire KLYX";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { id: requestId } = await context.params;

    const { data: marketRequest, error: requestError } =
      await supabaseAdmin
        .from("market_service_requests")
        .select(
          "id, client_profile_id, service_id, title, description, city, requested_date, requested_time, budget_max, status, accepted_offer_id, created_at"
        )
        .eq("id", requestId)
        .eq("client_profile_id", profile.id)
        .maybeSingle();

    if (requestError) throw new Error(requestError.message);

    if (!marketRequest) {
      return NextResponse.json(
        { error: "Demande introuvable." },
        { status: 404 }
      );
    }

    const [{ data: service }, { data: offers, error: offersError }] =
      await Promise.all([
        supabaseAdmin
          .from("services")
          .select("id, name, slug")
          .eq("id", marketRequest.service_id)
          .maybeSingle(),
        supabaseAdmin
          .from("market_service_offers")
          .select(
            "id, provider_profile_id, user_service_id, amount, message, status"
          )
          .eq("request_id", requestId)
          .in("status", ["sent", "accepted"])
          .order("created_at", { ascending: true }),
      ]);

    if (offersError) throw new Error(offersError.message);

    const offerRows = (offers ?? []) as OfferRow[];

    if (offerRows.length === 0) {
      return NextResponse.json({
        request: {
          id: marketRequest.id,
          title: marketRequest.title,
          serviceName: service?.name ?? "Service KLYX",
          city: marketRequest.city,
          budgetMax:
            marketRequest.budget_max === null
              ? null
              : Number(marketRequest.budget_max),
          status: marketRequest.status,
        },
        offers: [],
        recommendation: null,
        summary:
          "Aucune offre n’est encore disponible. KLYX pourra comparer les propositions dès qu’un prestataire répondra.",
      });
    }

    const providerIds = [
      ...new Set(offerRows.map((offer) => offer.provider_profile_id)),
    ];

    const userServiceIds = [
      ...new Set(offerRows.map((offer) => offer.user_service_id)),
    ];

    const [
      { data: profiles, error: profilesError },
      { data: providerProfiles, error: providerProfilesError },
      { data: serviceProfiles, error: serviceProfilesError },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", providerIds),
      supabaseAdmin
        .from("provider_profiles")
        .select("profile_id, years_experience, verification_status")
        .in("profile_id", providerIds),
      supabaseAdmin
        .from("service_profiles")
        .select("user_service_id, klyx_score, rating, review_count")
        .in("user_service_id", userServiceIds),
    ]);

    const firstError = [
      profilesError,
      providerProfilesError,
      serviceProfilesError,
    ].find(Boolean);

    if (firstError) throw new Error(firstError.message);

    const profileMap = new Map(
      (profiles ?? []).map((item) => [item.id, item])
    );

    const providerProfileMap = new Map(
      (providerProfiles ?? []).map((item) => [item.profile_id, item])
    );

    const serviceProfileMap = new Map(
      (serviceProfiles ?? []).map((item) => [item.user_service_id, item])
    );

    const ranked = offerRows
      .map((offer) => {
        const publicProfile = profileMap.get(offer.provider_profile_id);
        const providerProfile = providerProfileMap.get(
          offer.provider_profile_id
        );
        const serviceProfile = serviceProfileMap.get(offer.user_service_id);

        const ranking = calculateClientOfferRanking({
          amount: Number(offer.amount),
          budgetMax:
            marketRequest.budget_max === null
              ? null
              : Number(marketRequest.budget_max),
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
          id: offer.id,
          amount: Number(offer.amount),
          message: offer.message,
          status: offer.status,
          providerId: offer.provider_profile_id,
          providerName: providerName(
            publicProfile?.first_name ?? null,
            publicProfile?.last_name ?? null
          ),
          avatarUrl: publicProfile?.avatar_url ?? null,
          stats: {
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

        return first.amount - second.amount;
      });

    const cheapestAmount = Math.min(
      ...ranked.map((offer) => offer.amount)
    );

    const enriched = ranked.map((offer, index) => ({
      ...offer,
      isRecommended: index === 0,
      isCheapest: offer.amount === cheapestAmount,
    }));

    const best = enriched[0];

    const summaryParts = [
      `${best.providerName} obtient la meilleure recommandation KLYX avec ${best.ranking.score}/100.`,
      `Son offre est de ${best.amount.toFixed(2)} €.`,
    ];

    if (best.isCheapest) {
      summaryParts.push(
        "C’est aussi l’offre la moins chère actuellement."
      );
    } else {
      const cheapest = enriched.find((offer) => offer.isCheapest);

      if (cheapest) {
        summaryParts.push(
          `L’offre la moins chère est celle de ${cheapest.providerName} à ${cheapest.amount.toFixed(2)} €.`
        );
      }
    }

    if (best.ranking.reasons.length > 0) {
      summaryParts.push(
        `Points forts : ${best.ranking.reasons.join(", ")}.`
      );
    }

    summaryParts.push(
      "KLYX te conseille, mais ne choisit jamais à ta place."
    );

    return NextResponse.json({
      request: {
        id: marketRequest.id,
        title: marketRequest.title,
        serviceName: service?.name ?? "Service KLYX",
        city: marketRequest.city,
        budgetMax:
          marketRequest.budget_max === null
            ? null
            : Number(marketRequest.budget_max),
        status: marketRequest.status,
      },
      offers: enriched,
      recommendation: {
        offerId: best.id,
        providerId: best.providerId,
        providerName: best.providerName,
        score: best.ranking.score,
        amount: best.amount,
      },
      summary: summaryParts.join(" "),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’analyser les offres.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  estimateServiceTotal,
  orchestrateServiceRequest,
  serviceBudgetMatch,
  type KlyxPricingType,
  type KlyxServiceCandidate,
} from "@/lib/klyx-orchestration";
import type {
  ProviderSearchItem,
  ProviderSearchResponse,
} from "@/lib/provider-search";

type RecommendBody = {
  serviceSlug?: unknown;
  city?: unknown;
  date?: unknown;
  time?: unknown;
  budget?: unknown;
  durationHours?: unknown;
  pricingType?: unknown;
  requireVerified?: unknown;
  minimumTrustScore?: unknown;
  maximumCancellationRate?: unknown;
};

type RecommendationSolution = {
  provider: ProviderSearchItem;
  rank: number;
  recommended: boolean;
  score: number;
  estimatedPrice: number | null;
  reasons: ReturnType<typeof orchestrateServiceRequest>["solutions"][number]["reasons"];
  warnings: ReturnType<typeof orchestrateServiceRequest>["solutions"][number]["warnings"];
  profileUrl: string;
  bookingUrl: string;
  requiresConfirmation: true;
};

type RecommendationResponse = {
  provider: ProviderSearchItem | null;
  alternativesCount: number;
  showingAlternative: boolean;
  profileUrl?: string;
  bookingUrl?: string;
  recommendation: RecommendationSolution | null;
  solutions: RecommendationSolution[];
  orchestration: ReturnType<typeof orchestrateServiceRequest>;
};

function cleanString(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function validTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function positiveNumber(value: unknown, maximum: number): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) {
    return null;
  }

  return parsed;
}

function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");

  if (host) {
    const protocol =
      forwardedProtocol ?? (host.includes("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

function bookingUrl(
  provider: ProviderSearchItem,
  input: {
    city: string;
    date: string;
    time: string;
    durationHours: number;
    budget: number | null;
  }
): string {
  const params = new URLSearchParams({
    service: provider.serviceSlug,
    date: input.date,
    time: input.time,
    duration: String(input.durationHours),
  });

  if (input.city) params.set("city", input.city);
  if (input.budget !== null) params.set("budget", String(input.budget));

  return `/providers/${provider.profileId}/book?${params.toString()}`;
}

function providerLabel(provider: ProviderSearchItem): string {
  const business = provider.businessName.trim();
  if (business) return business;
  const person = `${provider.firstName} ${provider.lastName}`.trim();
  return person || provider.serviceLabel;
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as RecommendBody;
    const serviceSlug = cleanString(body.serviceSlug, 40);
    const city = cleanString(body.city, 80);
    const date = cleanString(body.date, 10);
    const time = cleanString(body.time, 5);
    const budget = positiveNumber(body.budget, 100000);
    const durationHours = positiveNumber(body.durationHours, 12) ?? 1;
    const pricingInput = cleanString(body.pricingType, 20);
    const pricingType: "all" | KlyxPricingType =
      pricingInput === "hourly" || pricingInput === "fixed"
        ? pricingInput
        : "all";
    const minimumTrustScore = positiveNumber(body.minimumTrustScore, 100);
    const maximumCancellationRate = positiveNumber(
      body.maximumCancellationRate,
      1
    );

    if (!serviceSlug || !city || !validDate(date) || !validTime(time)) {
      return NextResponse.json(
        { error: "Service, ville, date ou heure manquant." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      service: serviceSlug,
      city,
      date,
      time,
      duration: String(durationHours),
      sort: "recommended",
      analytics: "0",
    });

    if (pricingType !== "all") params.set("pricing", pricingType);

    // Le budget n'est volontairement pas envoyé à l'ancien filtre de recherche.
    // L'orchestrateur calcule le coût total avec la durée avant de décider.
    const searchUrl =
      `${requestOrigin(request)}/api/search/providers?${params.toString()}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const searchResult =
      (await response.json()) as ProviderSearchResponse & { error?: string };

    if (!response.ok) {
      throw new Error(
        searchResult.error || "Impossible de rechercher les prestataires."
      );
    }

    const candidates: KlyxServiceCandidate[] = searchResult.providers.map(
      (provider) => {
        const estimatedPrice = estimateServiceTotal(
          provider.price,
          provider.pricingType,
          durationHours
        );
        return {
          id: provider.userServiceId,
          profileId: provider.profileId,
          serviceSlug: provider.serviceSlug,
          providerLabel: providerLabel(provider),
          pricingType: provider.pricingType,
          price: provider.price,
          klyxScore: provider.klyxScore,
          rating: provider.rating,
          reviewCount: provider.reviewCount,
          completedJobs: provider.completedJobs,
          cancellationRate: provider.cancellationRate,
          yearsExperience: provider.yearsExperience,
          isVerified: provider.isVerified,
          skillMatch: provider.serviceSlug === serviceSlug,
          // La recherche canonique ne renvoie ici que les exacts dès qu'ils existent.
          // Un alternatif n'est jamais promu comme solution compatible.
          zoneMatch: provider.isExactMatch,
          availabilityMatch: provider.isExactMatch,
          pricingMatch:
            pricingType === "all" || provider.pricingType === pricingType,
          budgetMatch: serviceBudgetMatch(
            provider.price,
            provider.pricingType,
            durationHours,
            budget
          ),
          estimatedPrice,
        };
      }
    );

    const orchestration = orchestrateServiceRequest(
      {
        serviceSlug,
        city,
        date,
        startTime: time,
        endTime: null,
        durationHours,
        budgetMax: budget,
        pricingType,
        constraints: {
          requireVerified: body.requireVerified === true,
          minimumTrustScore,
          maximumCancellationRate,
        },
      },
      candidates,
      3
    );

    const providerById = new Map(
      searchResult.providers.map((provider) => [provider.profileId, provider])
    );

    const solutions = orchestration.solutions
      .map((solution): RecommendationSolution | null => {
        const provider = providerById.get(solution.providerId);
        if (!provider) return null;
        return {
          provider,
          rank: solution.rank,
          recommended: solution.recommended,
          score: solution.score,
          estimatedPrice: solution.estimatedPrice,
          reasons: solution.reasons,
          warnings: solution.warnings,
          profileUrl: `/providers/${provider.profileId}`,
          bookingUrl: bookingUrl(provider, {
            city,
            date,
            time,
            durationHours,
            budget,
          }),
          requiresConfirmation: true,
        };
      })
      .filter((item): item is RecommendationSolution => item !== null);

    const primary = solutions[0] ?? null;
    const result: RecommendationResponse = {
      provider: primary?.provider ?? null,
      alternativesCount: Math.max(solutions.length - 1, 0),
      showingAlternative: searchResult.showingAlternatives,
      ...(primary
        ? {
            profileUrl: primary.profileUrl,
            bookingUrl: primary.bookingUrl,
          }
        : {}),
      recommendation: primary,
      solutions,
      orchestration,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "KLYX ne peut pas préparer cette réservation.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

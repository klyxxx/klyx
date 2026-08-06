import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
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
};

type RecommendationResponse = {
  provider: ProviderSearchItem | null;
  alternativesCount: number;
  showingAlternative: boolean;
  profileUrl?: string;
  bookingUrl?: string;
};

function cleanString(
  value: unknown,
  maximumLength: number
): string {
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

  return hours >= 0 && hours <= 23 &&
    minutes >= 0 && minutes <= 59;
}

function positiveNumber(
  value: unknown,
  maximum: number
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function requestOrigin(request: Request): string {
  const forwardedHost =
    request.headers.get("x-forwarded-host");
  const host =
    forwardedHost ?? request.headers.get("host");
  const forwardedProtocol =
    request.headers.get("x-forwarded-proto");

  if (host) {
    const protocol =
      forwardedProtocol ??
      (host.includes("localhost") ? "http" : "https");

    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as RecommendBody;

    const serviceSlug = cleanString(
      body.serviceSlug,
      40
    );
    const city = cleanString(body.city, 80);
    const date = cleanString(body.date, 10);
    const time = cleanString(body.time, 5);
    const budget = positiveNumber(body.budget, 100000);
    const durationHours =
      positiveNumber(body.durationHours, 12) ?? 1;

    if (
      !serviceSlug ||
      !city ||
      !validDate(date) ||
      !validTime(time)
    ) {
      return NextResponse.json(
        {
          error:
            "Service, ville, date ou heure manquant.",
        },
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
    });

    if (budget !== null) {
      params.set("budget", String(budget));
    }

    const searchUrl =
      `${requestOrigin(request)}/api/search/providers?` +
      params.toString();

    const response = await fetch(searchUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const searchResult =
      (await response.json()) as ProviderSearchResponse & {
        error?: string;
      };

    if (!response.ok) {
      throw new Error(
        searchResult.error ||
          "Impossible de rechercher les prestataires."
      );
    }

    const provider = searchResult.providers[0] ?? null;

    if (!provider) {
      const result: RecommendationResponse = {
        provider: null,
        alternativesCount: 0,
        showingAlternative: false,
      };

      return NextResponse.json(result);
    }

    const bookingParams = new URLSearchParams({
      service: provider.serviceSlug,
      date,
      time,
      duration: String(durationHours),
    });

    if (city) bookingParams.set("city", city);
    if (budget !== null) {
      bookingParams.set("budget", String(budget));
    }

    const result: RecommendationResponse = {
      provider,
      alternativesCount: Math.max(
        searchResult.providers.length - 1,
        0
      ),
      showingAlternative:
        searchResult.showingAlternatives,
      profileUrl: `/providers/${provider.profileId}`,
      bookingUrl:
        `/providers/${provider.profileId}/book?` +
        bookingParams.toString(),
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

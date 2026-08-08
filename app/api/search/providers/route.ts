import { NextResponse } from "next/server";
import {
  DAY_LABELS,
  normalizeLocation,
  serviceLabel,
  timeToMinutes,
  type ProviderPricingType,
  type ProviderSearchItem,
  type ProviderSearchResponse,
  type ProviderSearchSort,
} from "@/lib/provider-search";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getApprovedUserServiceIds } from "@/lib/provider-skill-publication";

const SERVICE_SLUGS = ["babysitting", "cleaning", "moving", "handyman"];
const SORT_VALUES: ProviderSearchSort[] = [
  "recommended",
  "price_asc",
  "score_desc",
  "experience_desc",
];

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
};

type UserServiceRow = {
  id: string;
  user_id: string;
  service_id: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type ProviderProfileRow = {
  profile_id: string;
  business_name: string | null;
  headline: string | null;
  years_experience: number | null;
  verification_status: string | null;
};

type ServiceProfileRow = {
  user_service_id: string;
  title: string | null;
  pricing_type: string | null;
  price: number | null;
  city: string | null;
  service_area: string[] | null;
  travel_radius_km: number | null;
  klyx_score: number | null;
  completed_jobs: number | null;
  cancellation_rate: number | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ProviderZoneRow = {
  profile_id: string;
  user_service_id: string;
  is_active: boolean;
};

type Candidate = Omit<ProviderSearchItem, "availabilitySummary" | "isExactMatch"> & {
  slots: AvailabilityRow[];
};

type Filters = {
  serviceSlug: string;
  city: string;
  date: string;
  time: string;
  durationHours: number;
  budgetMax: number | null;
  pricingType: "all" | ProviderPricingType;
  sort: ProviderSearchSort;
};

type MatchState = {
  location: boolean;
  budget: boolean;
  pricing: boolean;
  availability: boolean;
};

function cleanText(value: string | null, maximum: number): string {
  return (value ?? "").trim().slice(0, maximum);
}

function numberParam(
  value: string | null,
  minimum: number,
  maximum: number
): number | null {
  if (!value?.trim()) return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function validDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const date = new Date(`${value}T12:00:00Z`);

  return Number.isNaN(date.getTime()) ? "" : value;
}

function parseFilters(request: Request): Filters {
  const params = new URL(request.url).searchParams;
  const requestedService = cleanText(params.get("service"), 40);
  const requestedPricing = cleanText(params.get("pricing"), 20);
  const requestedSort = cleanText(params.get("sort"), 30) as ProviderSearchSort;
  const requestedTime = cleanText(params.get("time"), 5);
  const duration = numberParam(params.get("duration"), 1, 12);

  return {
    serviceSlug: SERVICE_SLUGS.includes(requestedService)
      ? requestedService
      : "all",
    city: cleanText(params.get("city"), 80),
    date: validDate(cleanText(params.get("date"), 10)),
    time: timeToMinutes(requestedTime) === null ? "" : requestedTime,
    durationHours: duration ?? 1,
    budgetMax: numberParam(params.get("budget"), 0, 100000),
    pricingType:
      requestedPricing === "hourly" || requestedPricing === "fixed"
        ? requestedPricing
        : "all",
    sort: SORT_VALUES.includes(requestedSort) ? requestedSort : "recommended",
  };
}

function locationMatches(candidate: Candidate, city: string): boolean {
  if (!city) return true;

  const requested = normalizeLocation(city);

  return [candidate.city, ...candidate.serviceArea].some((location) => {
    const normalized = normalizeLocation(location);

    return Boolean(
      normalized &&
        (normalized.includes(requested) || requested.includes(normalized))
    );
  });
}

function availabilityMatches(candidate: Candidate, filters: Filters): boolean {
  if (!filters.date && !filters.time) return true;
  if (candidate.slots.length === 0) return false;

  const day = filters.date
    ? new Date(`${filters.date}T12:00:00Z`).getUTCDay()
    : null;
  const requestedStart = filters.time ? timeToMinutes(filters.time) : null;
  const requestedEnd =
    requestedStart === null
      ? null
      : requestedStart + filters.durationHours * 60;

  return candidate.slots.some((slot) => {
    if (day !== null && Number(slot.day_of_week) !== day) return false;

    if (requestedStart === null || requestedEnd === null) return true;

    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);

    return (
      slotStart !== null &&
      slotEnd !== null &&
      requestedStart >= slotStart &&
      requestedEnd <= slotEnd
    );
  });
}

function matchState(candidate: Candidate, filters: Filters): MatchState {
  return {
    location: locationMatches(candidate, filters.city),
    budget:
      filters.budgetMax === null ||
      (candidate.price !== null && candidate.price <= filters.budgetMax),
    pricing:
      filters.pricingType === "all" ||
      candidate.pricingType === filters.pricingType,
    availability: availabilityMatches(candidate, filters),
  };
}

function isExactMatch(state: MatchState): boolean {
  return Object.values(state).every(Boolean);
}

function relevance(state: MatchState): number {
  return (
    Number(state.location) * 35 +
    Number(state.availability) * 35 +
    Number(state.budget) * 20 +
    Number(state.pricing) * 10
  );
}

function compareCandidates(
  first: Candidate,
  second: Candidate,
  sort: ProviderSearchSort
): number {
  if (sort === "price_asc") {
    const firstPrice = first.price ?? Number.POSITIVE_INFINITY;
    const secondPrice = second.price ?? Number.POSITIVE_INFINITY;

    if (firstPrice !== secondPrice) return firstPrice - secondPrice;
  }

  if (sort === "experience_desc") {
    if (first.yearsExperience !== second.yearsExperience) {
      return second.yearsExperience - first.yearsExperience;
    }
  }

  if (sort === "score_desc" || sort === "recommended") {
    if (first.klyxScore !== second.klyxScore) {
      return second.klyxScore - first.klyxScore;
    }
  }

  if (first.completedJobs !== second.completedJobs) {
    return second.completedJobs - first.completedJobs;
  }

  return first.serviceLabel.localeCompare(second.serviceLabel, "fr");
}

function availabilitySummary(candidate: Candidate, filters: Filters): string {
  if (candidate.slots.length === 0) return "Horaires à confirmer";

  if (filters.date) {
    const day = new Date(`${filters.date}T12:00:00Z`).getUTCDay();
    const slot = candidate.slots.find((item) => Number(item.day_of_week) === day);

    if (slot) {
      return `Disponible ${DAY_LABELS[day]} de ${slot.start_time.slice(0, 5)} à ${slot.end_time.slice(0, 5)}`;
    }
  }

  const uniqueDays = new Set(candidate.slots.map((slot) => slot.day_of_week)).size;

  return `${uniqueDays} jour${uniqueDays > 1 ? "s" : ""} disponible${
    uniqueDays > 1 ? "s" : ""
  } par semaine`;
}

function publicItem(
  candidate: Candidate,
  filters: Filters,
  exact: boolean
): ProviderSearchItem {
  const { slots, ...provider } = candidate;
  void slots;

  return {
    ...provider,
    availabilitySummary: availabilitySummary(candidate, filters),
    isExactMatch: exact,
  };
}

async function loadCandidates(filters: Filters): Promise<Candidate[]> {
  let servicesQuery = supabaseAdmin
    .from("services")
    .select("id, name, slug")
    .in("slug", SERVICE_SLUGS);

  if (filters.serviceSlug !== "all") {
    servicesQuery = servicesQuery.eq("slug", filters.serviceSlug);
  }

  const servicesResult = await servicesQuery;

  if (servicesResult.error) throw new Error(servicesResult.error.message);

  const services = (servicesResult.data ?? []) as ServiceRow[];
  if (services.length === 0) return [];

  const userServicesResult = await supabaseAdmin
    .from("user_services")
    .select("id, user_id, service_id")
    .in(
      "service_id",
      services.map((service) => service.id)
    )
    .eq("active", true)
    .eq("provider_enabled", true);

  if (userServicesResult.error) throw new Error(userServicesResult.error.message);

  const allUserServices =
    (userServicesResult.data ?? []) as UserServiceRow[];

  if (allUserServices.length === 0) return [];

  const approvedUserServiceIds =
    await getApprovedUserServiceIds(
      allUserServices.map((item) => item.id)
    );

  const userServices =
    allUserServices.filter((item) =>
      approvedUserServiceIds.has(item.id)
    );

  if (userServices.length === 0) return [];

  const profileIds = [
    ...new Set(userServices.map((item) => item.user_id)),
  ];
  const userServiceIds =
    userServices.map((item) => item.id);

  const [
    profilesResult,
    providerProfilesResult,
    serviceProfilesResult,
    slotsResult,
    zonesResult,
  ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", profileIds),
      supabaseAdmin
        .from("provider_profiles")
        .select(
          "profile_id, business_name, headline, years_experience, verification_status"
        )
        .in("profile_id", profileIds)
        .eq("is_published", true),
      supabaseAdmin
        .from("service_profiles")
        .select(
          "user_service_id, title, pricing_type, price, city, service_area, travel_radius_km, klyx_score, completed_jobs, cancellation_rate"
        )
        .in("user_service_id", userServiceIds)
        .eq("available", true),
      supabaseAdmin
        .from("availability_slots")
        .select("user_service_id, day_of_week, start_time, end_time")
        .in("user_service_id", userServiceIds)
        .eq("is_active", true),
      supabaseAdmin
        .from("provider_service_zones")
        .select("profile_id, user_service_id, is_active")
        .in("profile_id", profileIds)
        .in("user_service_id", userServiceIds)
        .eq("is_active", true),
    ]);

  const firstError = [
    profilesResult.error,
    providerProfilesResult.error,
    serviceProfilesResult.error,
    slotsResult.error,
    zonesResult.error,
  ].find(Boolean);

  if (firstError) throw new Error(firstError.message);

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const providerProfiles = (providerProfilesResult.data ?? []) as ProviderProfileRow[];
  const serviceProfiles = (serviceProfilesResult.data ?? []) as ServiceProfileRow[];
  const slots = (slotsResult.data ?? []) as AvailabilityRow[];
  const zones = (zonesResult.data ?? []) as ProviderZoneRow[];

  const readyUserServiceIds = new Set(
    zones
      .filter((zone) => zone.is_active !== false)
      .map((zone) => zone.user_service_id)
  );

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const providerProfileById = new Map(
    providerProfiles.map((profile) => [profile.profile_id, profile])
  );
  const serviceProfileById = new Map(
    serviceProfiles.map((profile) => [profile.user_service_id, profile])
  );
  const slotsByUserService = new Map<string, AvailabilityRow[]>();

  for (const slot of slots) {
    const current = slotsByUserService.get(slot.user_service_id) ?? [];
    current.push(slot);
    slotsByUserService.set(slot.user_service_id, current);
  }

  return userServices
    .map((userService): Candidate | null => {
      const service = serviceById.get(userService.service_id);
      const profile = profileById.get(userService.user_id);
      const providerProfile = providerProfileById.get(userService.user_id);
      const serviceProfile = serviceProfileById.get(userService.id);

      if (!service || !profile || !providerProfile || !serviceProfile) return null;

      if (!readyUserServiceIds.has(userService.id)) return null;

      return {
        profileId: profile.id,
        userServiceId: userService.id,
        serviceSlug: service.slug,
        serviceLabel: serviceLabel(service.slug, service.name),
        firstName: profile.first_name ?? "",
        lastName: profile.last_name ?? "",
        businessName: providerProfile.business_name ?? "",
        avatarUrl: profile.avatar_url,
        headline: providerProfile.headline ?? "",
        title: serviceProfile.title ?? serviceLabel(service.slug, service.name),
        pricingType:
          serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly",
        price:
          serviceProfile.price === null ? null : Number(serviceProfile.price),
        city: serviceProfile.city ?? "",
        serviceArea: serviceProfile.service_area ?? [],
        travelRadiusKm: Number(serviceProfile.travel_radius_km ?? 10),
        klyxScore: Number(serviceProfile.klyx_score ?? 50),
        completedJobs: Number(serviceProfile.completed_jobs ?? 0),
        cancellationRate: Number(serviceProfile.cancellation_rate ?? 0),
        yearsExperience: Number(providerProfile.years_experience ?? 0),
        isVerified: providerProfile.verification_status === "verified",
        slots: slotsByUserService.get(userService.id) ?? [],
      };
    })
    .filter((candidate): candidate is Candidate => candidate !== null);
}

export async function GET(request: Request) {
  try {
    const filters = parseFilters(request);
    const candidates = await loadCandidates(filters);
    const withMatches = candidates.map((candidate) => {
      const state = matchState(candidate, filters);

      return {
        candidate,
        state,
        exact: isExactMatch(state),
        relevance: relevance(state),
      };
    });
    const exact = withMatches
      .filter((item) => item.exact)
      .map((item) => item.candidate)
      .sort((first, second) => compareCandidates(first, second, filters.sort));
    const hasCommercialFilters = Boolean(
      filters.city ||
        filters.date ||
        filters.time ||
        filters.budgetMax !== null ||
        filters.pricingType !== "all"
    );
    const alternatives =
      exact.length === 0 && hasCommercialFilters
        ? withMatches
            .sort((first, second) => {
              if (first.relevance !== second.relevance) {
                return second.relevance - first.relevance;
              }

              return compareCandidates(first.candidate, second.candidate, filters.sort);
            })
            .map((item) => item.candidate)
        : [];
    const displayed = exact.length > 0 ? exact : alternatives;
    const response: ProviderSearchResponse = {
      providers: displayed
        .slice(0, 48)
        .map((candidate) =>
          publicItem(candidate, filters, exact.length > 0)
        ),
      exactCount: exact.length,
      totalCandidates: candidates.length,
      showingAlternatives: exact.length === 0 && alternatives.length > 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de rechercher les prestataires.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}



import "server-only";

import { GET as getProviderJobs } from "@/app/api/provider/jobs/route";
import { findBelgianLocality } from "@/lib/belgian-localities";
import {
  orchestrateIncomeGoal,
  type KlyxIncomeGoal,
  type KlyxIncomeInterval,
  type KlyxIncomeMissionCandidate,
} from "@/lib/klyx-orchestration";
import {
  providerZonesCoverBelgianLocality,
  type ProviderSearchZoneCoverageInput,
} from "@/lib/provider-search-zone-coverage";
import { distanceBetweenLocalitiesKm } from "@/lib/service-zone-distance";
import { supabaseAdmin } from "@/lib/supabase-admin";

type JsonRecord = Record<string, unknown>;

type ProviderIdentity = {
  id: string;
  currencyCode: string;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
};

type ServiceProfileRow = {
  user_service_id: string;
  pricing_type: string | null;
  price: number | string | null;
  city: string | null;
  available: boolean | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ZoneRow = {
  user_service_id: string;
  country_code: string;
  locality: string;
  postal_code: string | null;
  radius_km: number | string;
  is_active: boolean;
};

type ConfirmedMission = {
  entityType?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  firstStart?: unknown;
  lastEnd?: unknown;
  history?: unknown;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.slice(0, 5));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function addMinutes(startTime: string, durationMinutes: number): string | null {
  const start = timeToMinutes(startTime);
  if (start === null || durationMinutes <= 0) return null;
  const total = start + Math.round(durationMinutes);
  if (total > 24 * 60) return null;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours >= 24) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dayOfWeek(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getUTCDay();
}

function availabilityContains(
  slots: readonly AvailabilityRow[],
  date: string,
  startTime: string,
  endTime: string
): boolean {
  const day = dayOfWeek(date);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (day === null || start === null || end === null) return false;

  return slots.some((slot) => {
    if (Number(slot.day_of_week) !== day) return false;
    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);
    return (
      slotStart !== null &&
      slotEnd !== null &&
      start >= slotStart &&
      end <= slotEnd &&
      end > start
    );
  });
}

function confirmedConflict(
  intervals: readonly KlyxIncomeInterval[],
  missions: readonly ConfirmedMission[]
): boolean {
  for (const mission of missions) {
    if (mission.history === true) continue;
    const dateFrom = asText(mission.dateFrom);
    const dateTo = asText(mission.dateTo) || dateFrom;
    if (!dateFrom) return true;

    for (const interval of intervals) {
      if (interval.date < dateFrom || interval.date > dateTo) continue;
      if (asText(mission.entityType) !== "booking" || dateFrom !== dateTo) {
        return true;
      }

      const missionStart = timeToMinutes(asText(mission.firstStart));
      const missionEnd = timeToMinutes(asText(mission.lastEnd));
      const start = timeToMinutes(interval.startTime);
      const end = timeToMinutes(interval.endTime);
      if (
        missionStart === null ||
        missionEnd === null ||
        start === null ||
        end === null
      ) {
        return true;
      }
      if (start < missionEnd && missionStart < end) return true;
    }
  }
  return false;
}

function straightLineDistanceKm(providerCity: string, requestCity: string): number | null {
  const provider = findBelgianLocality(providerCity);
  const request = findBelgianLocality(requestCity);
  if (!provider || !request) return null;
  return distanceBetweenLocalitiesKm(provider, request);
}

function intervalsFromJob(job: JsonRecord): {
  intervals: KlyxIncomeInterval[];
  durationMinutes: number | null;
  scheduleComplete: boolean;
} | null {
  const mode = asText(job.requestMode || job.request_mode);
  if (mode === "multi_slot") {
    const rawSlots = Array.isArray(job.slots) ? job.slots : [];
    const intervals: KlyxIncomeInterval[] = [];
    let totalDuration = 0;

    for (const rawSlot of rawSlots) {
      const slot = asRecord(rawSlot);
      if (!slot) return null;
      const date = asText(slot.date || slot.requested_date);
      const startTime = asText(slot.startTime || slot.start_time).slice(0, 5);
      const endTime = asText(slot.endTime || slot.end_time).slice(0, 5);
      const duration = asNumber(slot.durationMinutes || slot.duration_minutes);
      if (!date || !startTime || !endTime || timeToMinutes(endTime) === null) {
        return null;
      }
      intervals.push({ date, startTime, endTime });
      totalDuration += duration ?? Math.max(
        0,
        (timeToMinutes(endTime) ?? 0) - (timeToMinutes(startTime) ?? 0)
      );
    }

    if (intervals.length === 0 || totalDuration <= 0) return null;
    return { intervals, durationMinutes: totalDuration, scheduleComplete: true };
  }

  const date = asText(job.requested_date || job.requestedDate);
  const startTime = asText(job.requested_time || job.requestedTime).slice(0, 5);
  if (!date || !startTime || timeToMinutes(startTime) === null) return null;

  const durationMinutes =
    asNumber(job.totalDurationMinutes) ??
    asNumber(job.duration_minutes) ??
    (asNumber(job.duration_hours) !== null
      ? (asNumber(job.duration_hours) as number) * 60
      : null);
  const derivedEnd = durationMinutes !== null
    ? addMinutes(startTime, durationMinutes)
    : null;

  return {
    intervals: [{ date, startTime, endTime: derivedEnd ?? startTime }],
    durationMinutes,
    scheduleComplete: derivedEnd !== null,
  };
}

function goalDateMatches(goal: KlyxIncomeGoal, intervals: readonly KlyxIncomeInterval[]): boolean {
  if (goal.date && intervals.some((interval) => interval.date !== goal.date)) return false;
  if (goal.dayOfWeek !== null) {
    return intervals.every((interval) => dayOfWeek(interval.date) === goal.dayOfWeek);
  }
  return true;
}

export async function buildProviderIncomeOrchestration(
  request: Request,
  provider: ProviderIdentity,
  goal: KlyxIncomeGoal
) {
  const jobsResponse = await getProviderJobs(
    new Request(request.url, { method: "GET", headers: request.headers })
  );
  if (!jobsResponse.ok) {
    throw new Error("KLYX_PROVIDER_ORCHESTRATION_JOBS_UNAVAILABLE");
  }

  const payload = (await jobsResponse.json()) as {
    requests?: unknown[];
    confirmedMissions?: ConfirmedMission[];
  };
  const jobs = (payload.requests ?? [])
    .map(asRecord)
    .filter((item): item is JsonRecord => item !== null);
  const confirmedMissions = payload.confirmedMissions ?? [];

  const { data: userServiceData, error: userServiceError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true);
  if (userServiceError) throw new Error(userServiceError.message);

  const userServices = (userServiceData ?? []) as UserServiceRow[];
  const userServiceIds = userServices.map((item) => item.id);
  const serviceIds = [...new Set(userServices.map((item) => item.service_id))];

  const [servicesResult, profilesResult, availabilityResult, zonesResult] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin.from("services").select("id, slug, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    userServiceIds.length
      ? supabaseAdmin
          .from("service_profiles")
          .select("user_service_id, pricing_type, price, city, available")
          .in("user_service_id", userServiceIds)
      : Promise.resolve({ data: [], error: null }),
    userServiceIds.length
      ? supabaseAdmin
          .from("availability_slots")
          .select("user_service_id, day_of_week, start_time, end_time")
          .in("user_service_id", userServiceIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    userServiceIds.length
      ? supabaseAdmin
          .from("provider_service_zones")
          .select("user_service_id, country_code, locality, postal_code, radius_km, is_active")
          .in("user_service_id", userServiceIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = [
    servicesResult.error,
    profilesResult.error,
    availabilityResult.error,
    zonesResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const services = (servicesResult.data ?? []) as ServiceRow[];
  const profiles = (profilesResult.data ?? []) as ServiceProfileRow[];
  const availability = (availabilityResult.data ?? []) as AvailabilityRow[];
  const zones = (zonesResult.data ?? []) as ZoneRow[];

  const userServiceByServiceId = new Map(userServices.map((item) => [item.service_id, item.id]));
  const serviceById = new Map(services.map((item) => [item.id, item]));
  const profileByUserService = new Map(profiles.map((item) => [item.user_service_id, item]));
  const availabilityByUserService = new Map<string, AvailabilityRow[]>();
  const zonesByUserService = new Map<string, ProviderSearchZoneCoverageInput[]>();

  for (const slot of availability) {
    const current = availabilityByUserService.get(slot.user_service_id) ?? [];
    current.push(slot);
    availabilityByUserService.set(slot.user_service_id, current);
  }
  for (const zone of zones) {
    const current = zonesByUserService.get(zone.user_service_id) ?? [];
    current.push({
      countryCode: zone.country_code,
      locality: zone.locality,
      postalCode: zone.postal_code,
      radiusKm: Number(zone.radius_km),
      isActive: zone.is_active,
    });
    zonesByUserService.set(zone.user_service_id, current);
  }

  const expectedCurrency = goal.currency.toUpperCase();
  const candidates: KlyxIncomeMissionCandidate[] = [];

  for (const job of jobs) {
    if (job.myOffer) continue;
    const serviceId = asText(job.service_id || job.serviceId);
    const userServiceId = userServiceByServiceId.get(serviceId);
    if (!userServiceId) continue;
    const service = serviceById.get(serviceId);
    const serviceProfile = profileByUserService.get(userServiceId);
    if (!service || !serviceProfile || serviceProfile.available === false) continue;

    const id = asText(job.id || job.requestId || job.request_id);
    const title = asText(job.title);
    const city = asText(job.city);
    const currency = asText(job.currency).toUpperCase();
    if (!id || !title || !city || currency !== expectedCurrency) continue;

    const schedule = intervalsFromJob(job);
    if (!schedule || !goalDateMatches(goal, schedule.intervals)) continue;

    const zonesForService = zonesByUserService.get(userServiceId) ?? [];
    const zoneMatch = providerZonesCoverBelgianLocality(zonesForService, city);
    const slots = availabilityByUserService.get(userServiceId) ?? [];
    const availabilityMatch = schedule.intervals.every((interval) =>
      availabilityContains(slots, interval.date, interval.startTime, interval.endTime)
    );

    const relation = asRecord(job.service);
    const match = asRecord(job.match);
    const clientBudgetMax =
      asNumber(job.budgetTotal) ?? asNumber(job.budget_max) ?? null;
    const providerRate = asNumber(serviceProfile.price);
    const providerPricingType =
      serviceProfile.pricing_type === "fixed" ? "fixed" : "hourly";

    candidates.push({
      id,
      title,
      serviceSlug: service.slug,
      serviceLabel: asText(relation?.name) || service.name || service.slug,
      city,
      currency,
      providerPricingType,
      providerRate,
      durationMinutes: schedule.durationMinutes,
      clientBudgetMax,
      distanceKm: straightLineDistanceKm(serviceProfile.city ?? "", city),
      trustScore: asNumber(match?.score),
      skillMatch: true,
      zoneMatch,
      availabilityMatch,
      conflictsWithConfirmedMission: confirmedConflict(schedule.intervals, confirmedMissions),
      intervals: schedule.intervals,
      scheduleComplete: schedule.scheduleComplete,
    });
  }

  return {
    orchestration: orchestrateIncomeGoal(goal, candidates, 3),
    candidates,
  };
}

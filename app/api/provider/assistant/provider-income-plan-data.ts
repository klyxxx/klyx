import { GET as getProviderJobs } from "@/app/api/provider/jobs/route";
import {
  ProviderIncomeMissionCandidate,
  ProviderIncomePlanRequest,
  rankProviderIncomeCombinations,
} from "@/lib/provider-income-plan";
import { normalizeLocation, timeToMinutes } from "@/lib/provider-search";
import { supabaseAdmin } from "@/lib/supabase-admin";

type JsonRecord = Record<string, unknown>;

type ProviderJobSlot = {
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

type ProviderJob = {
  id?: unknown;
  service_id?: unknown;
  title?: unknown;
  city?: unknown;
  requested_date?: unknown;
  requested_time?: unknown;
  budget_max?: unknown;
  currency?: unknown;
  requestMode?: unknown;
  budgetTotal?: unknown;
  totalDurationMinutes?: unknown;
  slots?: unknown;
  service?: unknown;
  myOffer?: unknown;
};

type ConfirmedMission = {
  entityType?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  firstStart?: unknown;
  lastEnd?: unknown;
  history?: unknown;
};

type UserServiceRow = {
  id: string;
  service_id: string;
};

type ServiceProfileRow = {
  user_service_id: string;
  pricing_type: string | null;
  price: number | string | null;
  city: string | null;
  service_area: string[] | null;
  available: boolean | null;
};

type AvailabilityRow = {
  user_service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ProfileIdentity = {
  id: string;
  currencyCode: string;
};

const TEXT = {
  fr: {
    title: "Missions compatibles avec ton objectif",
    ready: (count: number, day: string) =>
      `J’ai trouvé ${count} option${count > 1 ? "s" : ""} compatible${count > 1 ? "s" : ""} pour ${day}. Les montants sont indicatifs : j’utilise ton tarif configuré quand il est calculable, sinon le budget maximum du client. Je n’ai accepté aucune mission ni envoyé aucune offre. Tu peux refuser ou ignorer une option sans pénalité.`,
    empty: (day: string) =>
      `Je n’ai trouvé aucune combinaison vérifiable pour ${day} avec tes métiers actifs, ta zone, tes disponibilités et l’objectif demandé. Je n’ai rien accepté ni envoyé.`,
    providerRate: (amount: string) => `${amount} selon ton tarif configuré`,
    clientBudget: (amount: string) => `${amount} de budget client maximum`,
    skill: "Métier actif compatible",
    zone: "Dans ta zone configurée",
    hours: "Créneau compatible avec tes disponibilités",
  },
  en: {
    title: "Jobs compatible with your income target",
    ready: (count: number, day: string) =>
      `I found ${count} compatible option${count > 1 ? "s" : ""} for ${day}. Amounts are indicative: I use your configured rate when it can be calculated, otherwise the client’s maximum budget. I did not accept any job or send any offer. You can ignore or decline an option without penalty.`,
    empty: (day: string) =>
      `I could not find a verifiable combination for ${day} matching your active skills, service area, availability and requested target. I did not accept or send anything.`,
    providerRate: (amount: string) => `${amount} based on your configured rate`,
    clientBudget: (amount: string) => `${amount} client maximum budget`,
    skill: "Compatible active skill",
    zone: "Inside your configured service area",
    hours: "Compatible with your availability",
  },
  nl: {
    title: "Opdrachten die bij je inkomensdoel passen",
    ready: (count: number, day: string) =>
      `Ik vond ${count} compatibele optie${count > 1 ? "s" : ""} voor ${day}. De bedragen zijn indicatief: ik gebruik je ingestelde tarief wanneer dat berekenbaar is, anders het maximumbudget van de klant. Ik heb geen opdracht geaccepteerd en geen aanbod verzonden. Je kunt een optie zonder straf negeren of weigeren.`,
    empty: (day: string) =>
      `Ik vond geen verifieerbare combinatie voor ${day} die past bij je actieve vaardigheden, zone, beschikbaarheid en doel. Ik heb niets geaccepteerd of verzonden.`,
    providerRate: (amount: string) => `${amount} op basis van je ingestelde tarief`,
    clientBudget: (amount: string) => `${amount} maximumbudget van de klant`,
    skill: "Compatibele actieve vaardigheid",
    zone: "Binnen je ingestelde werkzone",
    hours: "Compatibel met je beschikbaarheid",
  },
  de: {
    title: "Aufträge passend zu deinem Einkommensziel",
    ready: (count: number, day: string) =>
      `Ich habe ${count} kompatible Option${count > 1 ? "en" : ""} für ${day} gefunden. Die Beträge sind Richtwerte: Ich verwende deinen eingestellten Tarif, wenn er berechnet werden kann, sonst das maximale Kundenbudget. Ich habe keinen Auftrag angenommen und kein Angebot gesendet. Du kannst eine Option ohne Nachteil ablehnen oder ignorieren.`,
    empty: (day: string) =>
      `Ich habe für ${day} keine überprüfbare Kombination gefunden, die zu deinen aktiven Fähigkeiten, deinem Gebiet, deiner Verfügbarkeit und deinem Ziel passt. Ich habe nichts angenommen oder gesendet.`,
    providerRate: (amount: string) => `${amount} anhand deines eingestellten Tarifs`,
    clientBudget: (amount: string) => `${amount} maximales Kundenbudget`,
    skill: "Kompatible aktive Fähigkeit",
    zone: "Innerhalb deines eingestellten Einsatzgebiets",
    hours: "Mit deiner Verfügbarkeit kompatibel",
  },
} as const;

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

function dateDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

function locationMatches(
  requestCity: string,
  providerCity: string,
  serviceArea: string[]
): boolean {
  const requested = normalizeLocation(requestCity);
  if (!requested) return false;

  return [providerCity, ...serviceArea].some((location) => {
    const normalized = normalizeLocation(location);
    return Boolean(
      normalized &&
        (normalized.includes(requested) || requested.includes(normalized))
    );
  });
}

function availabilityContains(
  slots: AvailabilityRow[],
  dayOfWeek: number,
  startTime: string,
  endTime: string | null
): boolean {
  const start = timeToMinutes(startTime);
  const end = endTime ? timeToMinutes(endTime) : null;
  if (start === null) return false;

  return slots.some((slot) => {
    if (Number(slot.day_of_week) !== dayOfWeek) return false;

    const slotStart = timeToMinutes(slot.start_time);
    const slotEnd = timeToMinutes(slot.end_time);
    if (slotStart === null || slotEnd === null) return false;

    if (start < slotStart || start >= slotEnd) return false;
    return end === null || (end > start && end <= slotEnd);
  });
}

function requestedWindowContains(
  parsed: ProviderIncomePlanRequest,
  startTime: string,
  endTime: string | null
): boolean {
  if (!parsed.startTime || !parsed.endTime) return true;

  const requestedStart = timeToMinutes(parsed.startTime);
  const requestedEnd = timeToMinutes(parsed.endTime);
  const start = timeToMinutes(startTime);
  const end = endTime ? timeToMinutes(endTime) : null;

  if (
    requestedStart === null ||
    requestedEnd === null ||
    start === null
  ) {
    return false;
  }

  if (start < requestedStart || start >= requestedEnd) return false;
  return end === null || end <= requestedEnd;
}

function activeMissionConflicts(
  date: string,
  intervals: Array<{ startTime: string; endTime: string | null }>,
  confirmedMissions: ConfirmedMission[]
): boolean {
  for (const mission of confirmedMissions) {
    if (mission.history === true) continue;

    const dateFrom = asText(mission.dateFrom);
    const dateTo = asText(mission.dateTo) || dateFrom;
    if (!dateFrom || date < dateFrom || date > dateTo) continue;

    const entityType = asText(mission.entityType);
    if (entityType !== "booking" || dateFrom !== dateTo) {
      return true;
    }

    const missionStart = timeToMinutes(asText(mission.firstStart));
    const missionEnd = timeToMinutes(asText(mission.lastEnd));
    if (missionStart === null || missionEnd === null) return true;

    for (const interval of intervals) {
      const start = timeToMinutes(interval.startTime);
      const end = interval.endTime ? timeToMinutes(interval.endTime) : start;
      if (start === null || end === null) return true;

      const effectiveEnd = interval.endTime ? end : start + 1;
      if (start < missionEnd && missionStart < effectiveEnd) return true;
    }
  }

  return false;
}

function money(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toLocaleString("fr-BE", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function buildCandidate(params: {
  job: ProviderJob;
  parsed: ProviderIncomePlanRequest;
  userServiceId: string;
  profile: ServiceProfileRow;
  availability: AvailabilityRow[];
  confirmedMissions: ConfirmedMission[];
  expectedCurrency: string;
  today: string;
}): ProviderIncomeMissionCandidate | null {
  const {
    job,
    parsed,
    userServiceId,
    profile,
    availability,
    confirmedMissions,
    expectedCurrency,
    today,
  } = params;

  if (job.myOffer) return null;
  if (profile.available === false) return null;

  const id = asText(job.id);
  const title = asText(job.title);
  const city = asText(job.city);
  const currency = asText(job.currency).toUpperCase();
  const relation = asRecord(job.service);
  const serviceLabel = asText(relation?.name) || asText(relation?.slug) || "Service KLYX";

  if (!id || !title || !city || currency !== expectedCurrency) return null;

  const area = Array.isArray(profile.service_area)
    ? profile.service_area.filter((item): item is string => typeof item === "string")
    : [];
  if (!locationMatches(city, profile.city ?? "", area)) return null;

  const requestMode = asText(job.requestMode) === "multi_slot" ? "multi_slot" : "single";
  const intervals: Array<{ date: string; startTime: string; endTime: string | null }> = [];

  if (requestMode === "multi_slot") {
    const slots = Array.isArray(job.slots)
      ? job.slots.filter((item): item is ProviderJobSlot => Boolean(asRecord(item)))
      : [];

    if (slots.length === 0) return null;

    for (const slot of slots) {
      const date = asText(slot.date);
      const startTime = asText(slot.startTime).slice(0, 5);
      const endTime = asText(slot.endTime).slice(0, 5);

      if (
        !date ||
        date < today ||
        dateDay(date) !== parsed.dayOfWeek ||
        !startTime ||
        !endTime ||
        !availabilityContains(availability, parsed.dayOfWeek, startTime, endTime) ||
        !requestedWindowContains(parsed, startTime, endTime)
      ) {
        return null;
      }

      intervals.push({ date, startTime, endTime });
    }

    if (new Set(intervals.map((interval) => interval.date)).size !== 1) {
      return null;
    }
  } else {
    const date = asText(job.requested_date);
    const startTime = asText(job.requested_time).slice(0, 5);

    if (
      !date ||
      date < today ||
      dateDay(date) !== parsed.dayOfWeek ||
      !startTime ||
      !availabilityContains(availability, parsed.dayOfWeek, startTime, null) ||
      !requestedWindowContains(parsed, startTime, null)
    ) {
      return null;
    }

    intervals.push({ date, startTime, endTime: null });
  }

  const date = intervals[0].date;
  if (
    activeMissionConflicts(
      date,
      intervals.map(({ startTime, endTime }) => ({ startTime, endTime })),
      confirmedMissions
    )
  ) {
    return null;
  }

  const clientBudget =
    requestMode === "multi_slot"
      ? asNumber(job.budgetTotal)
      : asNumber(job.budget_max);
  const price = asNumber(profile.price);
  const durationMinutes = asNumber(job.totalDurationMinutes);
  const pricingType = profile.pricing_type === "fixed" ? "fixed" : "hourly";

  const providerEstimate =
    price === null
      ? null
      : pricingType === "fixed"
        ? price
        : durationMinutes !== null && durationMinutes > 0
          ? Math.round(price * (durationMinutes / 60) * 100) / 100
          : null;

  if (
    providerEstimate !== null &&
    clientBudget !== null &&
    providerEstimate > clientBudget
  ) {
    return null;
  }

  const potentialAmount = providerEstimate ?? clientBudget;
  if (potentialAmount === null || potentialAmount <= 0) return null;

  const text = TEXT[parsed.locale];
  const amountSource = providerEstimate !== null
    ? "provider_rate"
    : "client_budget_ceiling";
  const amountLabel = amountSource === "provider_rate"
    ? text.providerRate(money(potentialAmount, currency))
    : text.clientBudget(money(potentialAmount, currency));

  return {
    requestId: id,
    title,
    serviceLabel,
    city,
    date,
    startTime: intervals[0].startTime,
    endTime:
      intervals.length === 1 && intervals[0].endTime
        ? intervals[0].endTime
        : null,
    currency,
    potentialAmount,
    amountSource,
    amountLabel,
    reasons: [text.skill, text.zone, text.hours],
    intervals: intervals
      .filter(
        (interval): interval is { date: string; startTime: string; endTime: string } =>
          Boolean(interval.endTime)
      )
      .map((interval) => ({
        date: interval.date,
        startTime: interval.startTime,
        endTime: interval.endTime,
      })),
    intervalsComplete: intervals.every((interval) => Boolean(interval.endTime)),
  };
}

export async function buildProviderIncomePlanResult(
  request: Request,
  provider: ProfileIdentity,
  parsed: ProviderIncomePlanRequest
) {
  const jobsResponse = await getProviderJobs(request.clone());
  if (!jobsResponse.ok) {
    throw new Error("KLYX_PROVIDER_INCOME_PLAN_JOBS_UNAVAILABLE");
  }

  const jobsPayload = (await jobsResponse.json()) as {
    requests?: ProviderJob[];
    confirmedMissions?: ConfirmedMission[];
  };
  const jobs = jobsPayload.requests ?? [];
  const confirmedMissions = jobsPayload.confirmedMissions ?? [];

  const { data: userServiceData, error: userServiceError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true);

  if (userServiceError) throw new Error(userServiceError.message);

  const userServices = (userServiceData ?? []) as UserServiceRow[];
  const userServiceIds = userServices.map((item) => item.id);

  const [profileResult, availabilityResult] = await Promise.all([
    userServiceIds.length
      ? supabaseAdmin
          .from("service_profiles")
          .select("user_service_id, pricing_type, price, city, service_area, available")
          .in("user_service_id", userServiceIds)
      : Promise.resolve({ data: [], error: null }),
    userServiceIds.length
      ? supabaseAdmin
          .from("availability_slots")
          .select("user_service_id, day_of_week, start_time, end_time")
          .in("user_service_id", userServiceIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (availabilityResult.error) throw new Error(availabilityResult.error.message);

  const serviceProfileByUserServiceId = new Map(
    ((profileResult.data ?? []) as ServiceProfileRow[]).map((item) => [
      item.user_service_id,
      item,
    ])
  );
  const userServiceByServiceId = new Map(
    userServices.map((item) => [item.service_id, item.id])
  );
  const availabilityByUserServiceId = new Map<string, AvailabilityRow[]>();

  for (const slot of (availabilityResult.data ?? []) as AvailabilityRow[]) {
    const current = availabilityByUserServiceId.get(slot.user_service_id) ?? [];
    current.push(slot);
    availabilityByUserServiceId.set(slot.user_service_id, current);
  }

  const profileCurrency = provider.currencyCode.trim().toUpperCase();
  const expectedCurrency = parsed.targetCurrency ?? profileCurrency;
  const today = new Date().toISOString().slice(0, 10);
  const candidates: ProviderIncomeMissionCandidate[] = [];

  if (expectedCurrency === profileCurrency) {
    for (const job of jobs) {
      const serviceId = asText(job.service_id);
      const userServiceId = userServiceByServiceId.get(serviceId);
      if (!userServiceId) continue;

      const serviceProfile = serviceProfileByUserServiceId.get(userServiceId);
      if (!serviceProfile) continue;

      const candidate = buildCandidate({
        job,
        parsed,
        userServiceId,
        profile: serviceProfile,
        availability: availabilityByUserServiceId.get(userServiceId) ?? [],
        confirmedMissions,
        expectedCurrency,
        today,
      });

      if (candidate) candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.startTime.localeCompare(right.startTime);
  });

  const nearestDate = candidates[0]?.date ?? null;
  const sameDayCandidates = nearestDate
    ? candidates.filter((candidate) => candidate.date === nearestDate)
    : [];
  const combinations = rankProviderIncomeCombinations(
    sameDayCandidates,
    parsed.targetAmount,
    parsed.locale,
    3
  );
  const text = TEXT[parsed.locale];

  return {
    intent: "mission_plan" as const,
    title: text.title,
    reply:
      combinations.length > 0
        ? text.ready(combinations.length, parsed.dayLabel)
        : text.empty(parsed.dayLabel),
    payload: {
      targetAmount: parsed.targetAmount,
      currency: expectedCurrency,
      dayOfWeek: parsed.dayOfWeek,
      dayLabel: parsed.dayLabel,
      date: nearestDate,
      combinations,
      dataSource: "klyx_live",
      maxCombinations: 3,
      automaticAcceptance: false,
      automaticOffer: false,
      automaticBooking: false,
      automaticPayment: false,
      refusalPenalty: false,
      providerPriceChanged: false,
    },
    requiresConfirmation: true as const,
  };
}

import "server-only";

import type { AuthenticatedProfile } from "@/lib/api-auth";
import { normalizeLocation } from "@/lib/provider-search";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type KlyxIncomeOpportunity = {
  requestId: string;
  title: string;
  city: string;
  date: string | null;
  time: string | null;
  serviceLabel: string;
  potentialAmount: number | null;
  currency: string;
  amountSource: "configured_fixed_rate" | "client_budget_ceiling" | "unknown";
};

export type KlyxIncomeSearchResult = {
  reply: string;
  options: KlyxIncomeOpportunity[];
  targetAmount: number | null;
  targetCurrency: string | null;
  automaticExecutionAllowed: false;
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

type MarketRequestRow = {
  id: string;
  service_id: string;
  title: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | string | null;
  country_code: string;
  currency: string;
};

type ServiceRow = {
  id: string;
  name: string | null;
  slug: string;
};

const DAY_ALIASES = [
  { day: 1, aliases: ["lundi", "monday", "maandag", "montag"] },
  { day: 2, aliases: ["mardi", "tuesday", "dinsdag", "dienstag"] },
  { day: 3, aliases: ["mercredi", "wednesday", "woensdag", "mittwoch"] },
  { day: 4, aliases: ["jeudi", "thursday", "donderdag", "donnerstag"] },
  { day: 5, aliases: ["vendredi", "friday", "vrijdag", "freitag"] },
  { day: 6, aliases: ["samedi", "saturday", "zaterdag", "samstag"] },
  { day: 0, aliases: ["dimanche", "sunday", "zondag", "sonntag"] },
] as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIncomeTarget(message: string) {
  const explicit = message.match(
    /(?:€|\$|£)\s*(\d{1,6}(?:[.,]\d{1,2})?)|(\d{1,6}(?:[.,]\d{1,2})?)\s*(€|eur|euros?|\$|usd|£|gbp)/i
  );
  const amountText = explicit?.[1] ?? explicit?.[2] ?? null;
  const marker = explicit?.[3] ?? explicit?.[0]?.match(/[€$£]/)?.[0] ?? null;

  if (amountText) {
    const amount = Number(amountText.replace(",", "."));
    const normalizedMarker = marker?.toLowerCase() ?? "";
    const currency =
      normalizedMarker.includes("$") || normalizedMarker.includes("usd")
        ? "USD"
        : normalizedMarker.includes("£") || normalizedMarker.includes("gbp")
          ? "GBP"
          : normalizedMarker
            ? "EUR"
            : null;

    if (Number.isFinite(amount) && amount > 0) {
      return { amount, currency };
    }
  }

  const contextual = normalize(message).match(
    /(?:gagner|revenu|objectif|earn|income|target|verdienen|inkomen|einkommen).{0,30}?(\d{1,6}(?:[.,]\d{1,2})?)/i
  );

  if (!contextual) return { amount: null, currency: null };
  const amount = Number(contextual[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0
    ? { amount, currency: null }
    : { amount: null, currency: null };
}

function parseRequestedDay(message: string): number | null {
  const value = normalize(message);
  for (const candidate of DAY_ALIASES) {
    if (candidate.aliases.some((alias) => value.includes(alias))) {
      return candidate.day;
    }
  }
  return null;
}

function dayOfWeek(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

function locationCompatible(
  requestCity: string,
  profile: ServiceProfileRow
): boolean {
  const requested = normalizeLocation(requestCity);
  if (!requested) return false;

  const locations = [
    profile.city ?? "",
    ...(Array.isArray(profile.service_area) ? profile.service_area : []),
  ];

  return locations.some((location) => {
    const normalized = normalizeLocation(location);
    return Boolean(
      normalized &&
        (normalized.includes(requested) || requested.includes(normalized))
    );
  });
}

function serviceLabel(service: ServiceRow | undefined) {
  return service?.name?.trim() || service?.slug || "Service KLYX";
}

function formatAmount(amount: number, currency: string) {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toLocaleString("fr-BE", {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export async function searchKlyxIncomeOpportunities(
  profile: AuthenticatedProfile,
  message: string
): Promise<KlyxIncomeSearchResult> {
  const target = parseIncomeTarget(message);
  const requestedDay = parseRequestedDay(message);

  const { data: userServicesData, error: userServicesError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", profile.id)
    .eq("active", true)
    .eq("provider_enabled", true);

  if (userServicesError) throw new Error(userServicesError.message);

  const userServices = (userServicesData ?? []) as UserServiceRow[];
  if (userServices.length === 0) {
    return {
      reply:
        "Je peux chercher des missions depuis ce même assistant, mais aucun service à proposer n’est encore activé sur ce compte. Ajoutez d’abord au moins un service que vous savez réaliser.",
      options: [],
      targetAmount: target.amount,
      targetCurrency: target.currency,
      automaticExecutionAllowed: false,
    };
  }

  const userServiceIds = userServices.map((item) => item.id);
  const serviceIds = [...new Set(userServices.map((item) => item.service_id))];

  const [profilesResult, requestsResult, servicesResult] = await Promise.all([
    supabaseAdmin
      .from("service_profiles")
      .select("user_service_id, pricing_type, price, city, service_area, available")
      .in("user_service_id", userServiceIds),
    supabaseAdmin
      .from("market_service_requests")
      .select(
        "id, service_id, title, city, requested_date, requested_time, budget_max, country_code, currency"
      )
      .eq("status", "open")
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("services")
      .select("id, name, slug")
      .in("id", serviceIds),
  ]);

  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (requestsResult.error) throw new Error(requestsResult.error.message);
  if (servicesResult.error) throw new Error(servicesResult.error.message);

  const serviceProfiles = (profilesResult.data ?? []) as ServiceProfileRow[];
  const requests = (requestsResult.data ?? []) as MarketRequestRow[];
  const services = (servicesResult.data ?? []) as ServiceRow[];
  const serviceMap = new Map(services.map((item) => [item.id, item]));
  const userServiceByService = new Map(
    userServices.map((item) => [item.service_id, item.id])
  );
  const profileByUserService = new Map(
    serviceProfiles.map((item) => [item.user_service_id, item])
  );
  const expectedCountry = profile.countryCode.trim().toUpperCase();
  const expectedCurrency = (
    target.currency || profile.currencyCode || "EUR"
  ).trim().toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  const opportunities = requests
    .map((request): KlyxIncomeOpportunity | null => {
      if (request.requested_date && request.requested_date < today) return null;
      if (
        requestedDay !== null &&
        dayOfWeek(request.requested_date) !== requestedDay
      ) {
        return null;
      }

      if (
        expectedCountry &&
        request.country_code.trim().toUpperCase() !== expectedCountry
      ) {
        return null;
      }

      const currency = request.currency.trim().toUpperCase();
      if (expectedCurrency && currency !== expectedCurrency) return null;

      const userServiceId = userServiceByService.get(request.service_id);
      if (!userServiceId) return null;
      const serviceProfile = profileByUserService.get(userServiceId);
      if (!serviceProfile || serviceProfile.available === false) return null;
      if (!locationCompatible(request.city, serviceProfile)) return null;

      const configuredPrice = numberOrNull(serviceProfile.price);
      const clientBudget = numberOrNull(request.budget_max);
      const fixedPrice =
        serviceProfile.pricing_type === "fixed" ? configuredPrice : null;

      if (
        fixedPrice !== null &&
        clientBudget !== null &&
        fixedPrice > clientBudget
      ) {
        return null;
      }

      const potentialAmount = fixedPrice ?? clientBudget;
      const amountSource =
        fixedPrice !== null
          ? "configured_fixed_rate"
          : clientBudget !== null
            ? "client_budget_ceiling"
            : "unknown";

      return {
        requestId: request.id,
        title: request.title,
        city: request.city,
        date: request.requested_date,
        time: request.requested_time?.slice(0, 5) ?? null,
        serviceLabel: serviceLabel(serviceMap.get(request.service_id)),
        potentialAmount,
        currency,
        amountSource,
      };
    })
    .filter((item): item is KlyxIncomeOpportunity => Boolean(item))
    .sort((left, right) => {
      if (target.amount !== null) {
        const leftGap =
          left.potentialAmount === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(left.potentialAmount - target.amount);
        const rightGap =
          right.potentialAmount === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(right.potentialAmount - target.amount);
        if (leftGap !== rightGap) return leftGap - rightGap;
      }

      return (left.date ?? "9999-12-31").localeCompare(
        right.date ?? "9999-12-31"
      );
    })
    .slice(0, 3);

  if (opportunities.length === 0) {
    return {
      reply:
        "Je n’ai trouvé aucune mission compatible vérifiable avec vos services actifs, votre zone et le créneau demandé. Je n’ai accepté aucune mission et envoyé aucune offre.",
      options: [],
      targetAmount: target.amount,
      targetCurrency: target.currency,
      automaticExecutionAllowed: false,
    };
  }

  const lines = opportunities.map((option, index) => {
    const when = [option.date, option.time].filter(Boolean).join(" à ");
    const amount =
      option.potentialAmount === null
        ? "montant à confirmer"
        : option.amountSource === "configured_fixed_rate"
          ? `${formatAmount(option.potentialAmount, option.currency)} selon votre tarif fixe`
          : `${formatAmount(option.potentialAmount, option.currency)} de budget client maximum`;

    return `${index + 1}. ${option.title} — ${option.city}${
      when ? ` — ${when}` : ""
    } — ${amount}.`;
  });

  const targetText =
    target.amount === null
      ? ""
      : ` autour de ${formatAmount(target.amount, expectedCurrency)}`;

  return {
    reply: [
      `J’ai trouvé ${opportunities.length} mission${
        opportunities.length > 1 ? "s" : ""
      } compatible${opportunities.length > 1 ? "s" : ""}${targetText}.`,
      ...lines,
      "Je n’ai accepté aucune mission et envoyé aucune offre.",
    ].join("\n"),
    options: opportunities,
    targetAmount: target.amount,
    targetCurrency: target.currency,
    automaticExecutionAllowed: false,
  };
}

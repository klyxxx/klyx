import "server-only";

import {
  ensureLegacyOfferCompatibilityProfile,
  loadAccountCapabilityState,
  writeAccountCapabilities,
} from "@/lib/account-actor-capabilities-server";
import type {
  AccountOfferReadinessStatus,
  AccountOfferRequirement,
  OfferAvailabilityDraft,
  OfferPricingDraft,
} from "@/lib/account-offer-readiness";
import { findBelgianLocality } from "@/lib/belgian-localities";
import { KLYX_SERVICE_CATALOG } from "@/lib/klyx-service-catalog";
import { getCanonicalStripeConnect } from "@/lib/stripe-connect-account";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { listTrustDecisions } from "@/lib/trust-safety/server";

type ProfileRow = {
  id: string;
  account_type: string | null;
  country_code: string | null;
  currency_code: string | null;
  city: string | null;
};

type UserServiceRow = {
  id: string;
  service_id: string;
  active: boolean | null;
  provider_enabled: boolean | null;
};

type ServiceRow = {
  id: string;
  slug: string;
  name: string;
};

type ServiceProfileRow = {
  id: string;
  pricing_type: string | null;
  price: number | string | null;
  hourly_price: number | string | null;
  fixed_price: number | string | null;
};

type SelectedService = {
  service: ServiceRow;
  userService: UserServiceRow;
};

export type AccountOfferReadiness = {
  accountId: string;
  status: AccountOfferReadinessStatus;
  missing: AccountOfferRequirement[];
  compatibilityProfileId: string | null;
  service: {
    id: string;
    slug: string;
    name: string;
    userServiceId: string;
    categoryKey: string | null;
  } | null;
  jurisdictionCode: string | null;
  payoutsReady: boolean;
  stripeProfileId: string | null;
  payoutReviewRequired: boolean;
  payoutReason: string | null;
  trust: {
    accessDecision: "allowed" | "human_review" | "blocked" | "missing";
    decisionId: string | null;
    reasonCodes: string[];
    requiredActions: Array<{ code: string; detail?: string }>;
    explanation: string | null;
  };
};

export type RecordAccountOfferFactsInput = {
  accountId: string;
  serviceSlug?: string | null;
  city?: string | null;
  radiusKm?: number | null;
  pricing?: OfferPricingDraft | null;
  availability?: OfferAvailabilityDraft | null;
};

function normalizeCatalogLabel(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serviceCategoryKey(service: ServiceRow): string | null {
  const normalizedName = normalizeCatalogLabel(service.name);
  const category = KLYX_SERVICE_CATALOG.find((candidate) =>
    candidate.services.some(
      (serviceName) => normalizeCatalogLabel(serviceName) === normalizedName
    )
  );

  return category?.slug ?? null;
}

function regionalJurisdictionCode(profile: ProfileRow): string | null {
  const countryCode = (profile.country_code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  if (countryCode !== "BE") return countryCode;

  const locality = profile.city ? findBelgianLocality(profile.city) : null;
  if (!locality) return "BE";

  switch (locality.region) {
    case "Bruxelles":
      return "BE-BRU";
    case "Wallonie":
      return "BE-WAL";
    case "Flandre":
      return "BE-VLG";
  }
}

function positiveNumber(value: unknown): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function pricingReady(profile: ServiceProfileRow | null): boolean {
  if (!profile) return false;
  if (profile.pricing_type === "hourly") {
    return positiveNumber(profile.hourly_price ?? profile.price);
  }
  if (profile.pricing_type === "fixed") {
    return positiveNumber(profile.fixed_price ?? profile.price);
  }
  return false;
}

async function accountProfiles(accountId: string): Promise<ProfileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type, country_code, currency_code, city")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

async function resolveCompatibilityProfile(
  profiles: readonly ProfileRow[]
): Promise<ProfileRow | null> {
  if (profiles.length === 0) return null;

  const profileIds = profiles.map((profile) => profile.id);
  const { data, error } = await supabaseAdmin
    .from("provider_profiles")
    .select("profile_id")
    .in("profile_id", profileIds);

  if (error) throw new Error(error.message);

  const providerIds = new Set(
    ((data ?? []) as Array<{ profile_id: string }>).map((row) => row.profile_id)
  );

  return (
    profiles.find((profile) => providerIds.has(profile.id)) ??
    profiles.find((profile) => profile.account_type === "provider") ??
    profiles[0]
  );
}

async function loadSelectedService(params: {
  profileId: string;
  serviceSlug?: string | null;
}): Promise<SelectedService | null> {
  if (params.serviceSlug) {
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, slug, name")
      .eq("slug", params.serviceSlug)
      .maybeSingle();

    if (serviceError) throw new Error(serviceError.message);
    const service = serviceData as ServiceRow | null;
    if (!service) return null;

    const { data: userServiceData, error: userServiceError } = await supabaseAdmin
      .from("user_services")
      .select("id, service_id, active, provider_enabled")
      .eq("user_id", params.profileId)
      .eq("service_id", service.id)
      .eq("provider_enabled", true)
      .maybeSingle();

    if (userServiceError) throw new Error(userServiceError.message);
    const userService = userServiceData as UserServiceRow | null;
    return userService ? { service, userService } : null;
  }

  const { data: userServiceData, error: userServiceError } = await supabaseAdmin
    .from("user_services")
    .select("id, service_id, active, provider_enabled")
    .eq("user_id", params.profileId)
    .eq("provider_enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (userServiceError) throw new Error(userServiceError.message);
  const userService = userServiceData as UserServiceRow | null;
  if (!userService) return null;

  const { data: serviceData, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, slug, name")
    .eq("id", userService.service_id)
    .maybeSingle();

  if (serviceError) throw new Error(serviceError.message);
  const service = serviceData as ServiceRow | null;
  return service ? { service, userService } : null;
}

async function latestCategoryDecision(params: {
  accountId: string;
  categoryKey: string;
  jurisdictionCode: string;
}) {
  const jurisdictionCandidates =
    params.jurisdictionCode.startsWith("BE-")
      ? [params.jurisdictionCode, "BE"]
      : [params.jurisdictionCode];

  for (const jurisdictionCode of jurisdictionCandidates) {
    const decisions = await listTrustDecisions({
      accountId: params.accountId,
      targetType: "category",
      categoryKey: params.categoryKey,
      jurisdictionCode,
      limit: 1,
    });
    const decision = decisions[0] ?? null;
    if (decision) return { decision, jurisdictionCode };
  }

  return { decision: null, jurisdictionCode: jurisdictionCandidates[0] ?? null };
}

export async function loadAccountOfferReadiness(params: {
  accountId: string;
  serviceSlug?: string | null;
}): Promise<AccountOfferReadiness> {
  const profiles = await accountProfiles(params.accountId);
  const compatibilityProfile = await resolveCompatibilityProfile(profiles);
  const selected = compatibilityProfile
    ? await loadSelectedService({
        profileId: compatibilityProfile.id,
        serviceSlug: params.serviceSlug,
      })
    : null;
  const missing: AccountOfferRequirement[] = [];

  if (!selected) missing.push("skills");

  let serviceProfile: ServiceProfileRow | null = null;
  let zoneReady = false;
  let availabilityReady = false;

  if (selected && compatibilityProfile) {
    const [serviceProfileResult, zoneResult, availabilityResult] = await Promise.all([
      supabaseAdmin
        .from("service_profiles")
        .select("id, pricing_type, price, hourly_price, fixed_price")
        .eq("user_service_id", selected.userService.id)
        .maybeSingle(),
      supabaseAdmin
        .from("provider_service_zones")
        .select("id")
        .eq("profile_id", compatibilityProfile.id)
        .eq("user_service_id", selected.userService.id)
        .eq("is_active", true)
        .limit(1),
      supabaseAdmin
        .from("availability_slots")
        .select("id")
        .eq("user_service_id", selected.userService.id)
        .eq("is_active", true)
        .limit(1),
    ]);

    for (const result of [serviceProfileResult, zoneResult, availabilityResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    serviceProfile = serviceProfileResult.data as ServiceProfileRow | null;
    zoneReady = (zoneResult.data ?? []).length > 0;
    availabilityReady = (availabilityResult.data ?? []).length > 0;
  }

  if (selected && !zoneReady) missing.push("zone");
  if (selected && !availabilityReady) missing.push("availability");
  if (selected && !pricingReady(serviceProfile)) missing.push("pricing");

  const connect = await getCanonicalStripeConnect(params.accountId);
  const payoutsReady =
    connect.state === "linked" &&
    Boolean(connect.stripeAccountId?.trim()) &&
    connect.onboardingComplete &&
    connect.chargesEnabled &&
    connect.payoutsEnabled;
  const payoutReviewRequired = connect.state === "review_required";
  if (!payoutsReady) missing.push("payouts");

  const categoryKey = selected ? serviceCategoryKey(selected.service) : null;
  const jurisdictionCode = compatibilityProfile
    ? regionalJurisdictionCode(compatibilityProfile)
    : null;
  let trust: AccountOfferReadiness["trust"] = {
    accessDecision: "missing",
    decisionId: null,
    reasonCodes: [],
    requiredActions: [],
    explanation: null,
  };
  let trustBlocked = false;
  let humanReview = payoutReviewRequired;

  if (selected && compatibilityProfile) {
    if (!categoryKey) {
      humanReview = true;
      missing.push("legal");
      trust = {
        ...trust,
        accessDecision: "human_review",
        reasonCodes: ["CATEGORY_MAPPING_REQUIRED"],
        requiredActions: [{ code: "COMPLETE_CATEGORY_REVIEW" }],
        explanation:
          "This service is not mapped to a canonical KLYX policy category. Automatic activation is forbidden until a human review maps it.",
      };
    } else if (!jurisdictionCode) {
      humanReview = true;
      missing.push("legal");
      trust = {
        ...trust,
        accessDecision: "human_review",
        reasonCodes: ["JURISDICTION_REQUIRED"],
        requiredActions: [{ code: "REQUEST_LEGAL_REVIEW" }],
        explanation:
          "A jurisdiction is required before KLYX can evaluate legal and Trust & Safety eligibility.",
      };
    } else {
      const lookup = await latestCategoryDecision({
        accountId: params.accountId,
        categoryKey,
        jurisdictionCode,
      });
      const decision = lookup.decision;

      if (!decision) {
        humanReview = true;
        missing.push("legal");
        trust = {
          ...trust,
          accessDecision: "human_review",
          reasonCodes: ["TRUST_DECISION_REQUIRED"],
          requiredActions: [{ code: "REQUEST_LEGAL_REVIEW" }],
          explanation:
            "No current account-level category eligibility decision exists. KLYX fails closed instead of inferring legal status.",
        };
      } else {
        trust = {
          accessDecision: decision.accessDecision,
          decisionId: decision.id,
          reasonCodes: decision.reasonCodes,
          requiredActions: decision.requiredActions,
          explanation: decision.explanation,
        };

        if (decision.accessDecision === "human_review") {
          humanReview = true;
          missing.push("legal");
        } else if (decision.accessDecision === "blocked") {
          if (decision.decision === "ineligible") {
            trustBlocked = true;
          } else {
            missing.push("trust_safety");
          }
        }
      }
    }
  }

  const uniqueMissing = Array.from(new Set(missing));
  const hasCollectableMissing = uniqueMissing.some((item) =>
    ["skills", "zone", "availability", "pricing", "payouts", "trust_safety"].includes(item)
  );
  const status: AccountOfferReadinessStatus = trustBlocked
    ? "blocked"
    : payoutReviewRequired
      ? "human_review"
      : hasCollectableMissing
        ? "missing_requirements"
        : humanReview
          ? "human_review"
          : "ready";

  return {
    accountId: params.accountId,
    status,
    missing: uniqueMissing,
    compatibilityProfileId: compatibilityProfile?.id ?? null,
    service: selected
      ? {
          id: selected.service.id,
          slug: selected.service.slug,
          name: selected.service.name,
          userServiceId: selected.userService.id,
          categoryKey,
        }
      : null,
    jurisdictionCode,
    payoutsReady,
    stripeProfileId: payoutsReady ? compatibilityProfile?.id ?? null : null,
    payoutReviewRequired,
    payoutReason: payoutReviewRequired
      ? "Multiple historical Stripe Connected Account identifiers are linked to this canonical KLYX account. Automatic selection is forbidden."
      : null,
    trust,
  };
}

export async function recordAccountOfferConversationFacts(
  input: RecordAccountOfferFactsInput
): Promise<{ profileId: string; userServiceId: string } | null> {
  const serviceSlug = input.serviceSlug?.trim();
  if (!serviceSlug) return null;

  const profileId = await ensureLegacyOfferCompatibilityProfile(input.accountId);
  const [{ data: serviceData, error: serviceError }, profileResult] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, slug, name")
      .eq("slug", serviceSlug)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id, country_code")
      .eq("id", profileId)
      .eq("account_id", input.accountId)
      .single(),
  ]);

  if (serviceError) throw new Error(serviceError.message);
  if (profileResult.error) throw new Error(profileResult.error.message);

  const service = serviceData as ServiceRow | null;
  if (!service) throw new Error("KLYX_OFFER_SERVICE_NOT_FOUND");

  const existingResult = await supabaseAdmin
    .from("user_services")
    .select("id, service_id, active, provider_enabled")
    .eq("user_id", profileId)
    .eq("service_id", service.id)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);

  let userService = existingResult.data as UserServiceRow | null;
  if (!userService) {
    const { data, error } = await supabaseAdmin
      .from("user_services")
      .insert({
        user_id: profileId,
        service_id: service.id,
        active: false,
        provider_enabled: true,
      })
      .select("id, service_id, active, provider_enabled")
      .single();
    if (error) throw new Error(error.message);
    userService = data as UserServiceRow;
  } else if (userService.provider_enabled !== true) {
    const { error } = await supabaseAdmin
      .from("user_services")
      .update({ provider_enabled: true })
      .eq("id", userService.id)
      .eq("user_id", profileId);
    if (error) throw new Error(error.message);
  }

  if (input.city) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ city: input.city, updated_at: new Date().toISOString() })
      .eq("id", profileId)
      .eq("account_id", input.accountId);
    if (error) throw new Error(error.message);
  }

  const serviceProfileResult = await supabaseAdmin
    .from("service_profiles")
    .select("id, pricing_type, price, hourly_price, fixed_price")
    .eq("user_service_id", userService.id)
    .maybeSingle();
  if (serviceProfileResult.error) {
    throw new Error(serviceProfileResult.error.message);
  }

  const existingServiceProfile = serviceProfileResult.data as ServiceProfileRow | null;
  const patch: Record<string, unknown> = {};

  if (input.city) {
    patch.city = input.city;
    patch.service_area = [input.city];
  }
  if (input.radiusKm != null) {
    patch.travel_radius_km = input.radiusKm;
  }
  if (input.pricing?.pricingType) {
    patch.pricing_type = input.pricing.pricingType;
    patch.price = input.pricing.amount;
    patch.hourly_price =
      input.pricing.pricingType === "hourly" ? input.pricing.amount : null;
    patch.fixed_price =
      input.pricing.pricingType === "fixed" ? input.pricing.amount : null;
  }

  if (existingServiceProfile && Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin
      .from("service_profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existingServiceProfile.id)
      .eq("user_service_id", userService.id);
    if (error) throw new Error(error.message);
  } else if (!existingServiceProfile && input.pricing?.pricingType) {
    const insertPayload: Record<string, unknown> = {
      user_service_id: userService.id,
      title: null,
      description: null,
      pricing_type: input.pricing.pricingType,
      price: input.pricing.amount,
      hourly_price:
        input.pricing.pricingType === "hourly" ? input.pricing.amount : null,
      fixed_price:
        input.pricing.pricingType === "fixed" ? input.pricing.amount : null,
      available: false,
      rating: 0,
      review_count: 0,
      updated_at: new Date().toISOString(),
    };

    if (input.city) {
      insertPayload.city = input.city;
      insertPayload.service_area = [input.city];
    }
    if (input.radiusKm != null) {
      insertPayload.travel_radius_km = input.radiusKm;
    }

    const { error } = await supabaseAdmin
      .from("service_profiles")
      .insert(insertPayload);
    if (error) throw new Error(error.message);
  }

  if (input.city && input.radiusKm != null) {
    const countryCode = (profileResult.data.country_code ?? "").trim().toUpperCase();
    const locality = countryCode === "BE" ? findBelgianLocality(input.city) : null;

    if (countryCode !== "BE" || !locality) {
      throw new Error("KLYX_OFFER_ZONE_REQUIRES_SUPPORTED_LOCALITY");
    }

    const postalCode = locality.postalCodes[0] ?? null;
    const { error } = await supabaseAdmin
      .from("provider_service_zones")
      .upsert(
        {
          profile_id: profileId,
          user_service_id: userService.id,
          country_code: countryCode,
          locality: locality.name,
          postal_code: postalCode,
          radius_km: input.radiusKm,
          is_primary: true,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_service_id,country_code,locality,postal_code" }
      );
    if (error) throw new Error(error.message);
  }

  if (input.availability) {
    const { error: deleteError } = await supabaseAdmin
      .from("availability_slots")
      .delete()
      .eq("user_service_id", userService.id)
      .eq("day_of_week", input.availability.dayOfWeek);
    if (deleteError) throw new Error(deleteError.message);

    const { error } = await supabaseAdmin.from("availability_slots").insert({
      user_service_id: userService.id,
      day_of_week: input.availability.dayOfWeek,
      start_time: input.availability.startTime,
      end_time: input.availability.endTime,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  return { profileId, userServiceId: userService.id };
}

async function enableReadyServiceAdapter(
  readiness: AccountOfferReadiness
): Promise<void> {
  if (!readiness.service || !readiness.compatibilityProfileId) {
    throw new Error("KLYX_OFFER_READY_SERVICE_REQUIRED");
  }

  const [userServiceResult, serviceProfileResult] = await Promise.all([
    supabaseAdmin
      .from("user_services")
      .update({ active: true, provider_enabled: true })
      .eq("id", readiness.service.userServiceId)
      .eq("user_id", readiness.compatibilityProfileId),
    supabaseAdmin
      .from("service_profiles")
      .update({ available: true, updated_at: new Date().toISOString() })
      .eq("user_service_id", readiness.service.userServiceId),
  ]);

  if (userServiceResult.error) throw new Error(userServiceResult.error.message);
  if (serviceProfileResult.error) throw new Error(serviceProfileResult.error.message);
}

export async function activateAccountOfferServices(params: {
  accountId: string;
  serviceSlug?: string | null;
}) {
  const firstReadiness = await loadAccountOfferReadiness(params);
  if (firstReadiness.status !== "ready") {
    return { activated: false as const, readiness: firstReadiness };
  }

  await ensureLegacyOfferCompatibilityProfile(params.accountId);

  // Re-evaluate immediately before changing storage or writing the canonical
  // capability. No client-supplied readiness snapshot is trusted.
  const readiness = await loadAccountOfferReadiness(params);
  if (readiness.status !== "ready") {
    return { activated: false as const, readiness };
  }

  // The service adapter becomes usable for the already merged orchestration
  // engine, but provider_profiles.is_published remains untouched. Public
  // discovery and regulated qualification gates therefore remain independent.
  await enableReadyServiceAdapter(readiness);

  await writeAccountCapabilities(
    params.accountId,
    { offer_services: true },
    { source: "system" }
  );

  const profiles = await accountProfiles(params.accountId);
  const capabilityState = await loadAccountCapabilityState(
    params.accountId,
    profiles.map((profile) => ({
      accountType: profile.account_type === "provider" ? "provider" : "client",
    }))
  );

  return {
    activated: capabilityState.canOfferServices,
    readiness,
    capabilityState,
  } as const;
}
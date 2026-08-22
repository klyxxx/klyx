import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  detectCatalogServiceCandidates,
  mergeServiceCandidates,
  normalizeCatalogText,
  resolveCatalogServiceDecision,
  type CatalogServiceRecord,
} from "@/lib/catalog-service-matcher";
import {
  canUseClientMemory,
  loadClientMemoryContext,
  recordClientMemoryUsage,
} from "@/lib/client-memory-context";
import {
  detectBudget,
  detectChildren,
  detectCity,
  detectDurationHours,
  detectRequestedDay,
  detectRequestedTime,
  detectServiceCandidates,
  missingFieldsForRequest,
  urgencyFromText,
  type ServiceCandidate,
  type UniversalRequestResult,
} from "@/lib/universal-service-request";

type AnalyzedUniversalRequest = UniversalRequestResult & {
  serviceAmbiguous: boolean;
  serviceConfidenceGap: number | null;
  clarificationCandidates: ServiceCandidate[];
  serviceClarificationMessage: string | null;
};

function isChildcareService(
  service: CatalogServiceRecord | undefined
): boolean {
  if (!service) return false;

  const normalized = normalizeCatalogText(
    `${service.slug} ${service.name ?? ""}`
  );

  return [
    "baby sitting",
    "babysitting",
    "garde enfant",
    "garde d enfant",
    "nounou",
  ].some((term) => normalized.includes(term));
}

function clarificationMessage(
  candidates: readonly ServiceCandidate[]
): string | null {
  const labels = candidates
    .slice(0, 3)
    .map((candidate) => candidate.label.trim())
    .filter(Boolean);

  if (labels.length < 2) return null;

  return `KLYX hésite entre ${labels.join(" et ")}. Choisis le métier qui correspond le mieux avant la recherche.`;
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      text?: unknown;
      selectedServiceSlug?: unknown;
    };

    const text =
      typeof body.text === "string"
        ? body.text.trim().slice(0, 2000)
        : "";

    if (text.length < 3) {
      return NextResponse.json(
        {
          error:
            "Décris ton besoin avec au moins trois caractères.",
        },
        { status: 400 }
      );
    }

    const selectedServiceSlug =
      typeof body.selectedServiceSlug === "string"
        ? body.selectedServiceSlug.trim()
        : "";

    const [memory, servicesResult] = await Promise.all([
      loadClientMemoryContext(profile.id),
      supabaseAdmin
        .from("services")
        .select("slug, name")
        .limit(1000),
    ]);

    if (servicesResult.error) {
      throw new Error(servicesResult.error.message);
    }

    const services = (
      servicesResult.data ?? []
    ).filter(
      (service): service is CatalogServiceRecord =>
        typeof service.slug === "string" &&
        service.slug.trim().length > 0
    );

    const serviceBySlug = new Map(
      services.map((service) => [service.slug, service])
    );

    const catalogCandidates =
      detectCatalogServiceCandidates(
        text,
        services,
        5
      );
    const legacyCandidates =
      detectServiceCandidates(text);
    const candidates = mergeServiceCandidates(
      services,
      catalogCandidates,
      legacyCandidates
    );
    const decision = resolveCatalogServiceDecision(candidates);

    const selectedService =
      selectedServiceSlug
        ? serviceBySlug.get(selectedServiceSlug)
        : undefined;
    const serviceAmbiguous =
      !selectedService && decision.ambiguous;
    const clarificationCandidates = serviceAmbiguous
      ? decision.clarificationCandidates
      : [];

    let serviceSlug =
      selectedService?.slug ??
      decision.selected?.slug ??
      null;
    let city = detectCity(text);
    const requestedDay = detectRequestedDay(text);
    let requestedTime = detectRequestedTime(text);
    const durationHours = detectDurationHours(text);
    let budgetMax = detectBudget(text);
    let peopleCount = isChildcareService(
      serviceSlug
        ? serviceBySlug.get(serviceSlug)
        : undefined
    )
      ? detectChildren(text)
      : null;
    const memoryFields: string[] = [];

    if (canUseClientMemory(text, memory)) {
      const preferredServiceSlug =
        memory.preferredServiceSlugs.find((slug) =>
          serviceBySlug.has(slug)
        ) ?? null;

      // Memory can fill an absent service only when the current request itself
      // is not ambiguous. A remembered habit must never silently break a tie
      // between two plausible current intents.
      if (
        !serviceSlug &&
        !serviceAmbiguous &&
        preferredServiceSlug
      ) {
        serviceSlug = preferredServiceSlug;
        memoryFields.push("preferred_service_slugs");
      }

      if (!city && memory.defaultCity) {
        city = memory.defaultCity;
        memoryFields.push("default_city");
      }

      if (budgetMax == null && memory.defaultBudget != null) {
        budgetMax = memory.defaultBudget;
        memoryFields.push("default_budget");
      }

      if (!requestedTime) {
        const rememberedTime = detectRequestedTime(
          memory.schedulingNotes ?? ""
        );

        if (rememberedTime) {
          requestedTime = rememberedTime;
          memoryFields.push("scheduling_notes");
        }
      }

      if (
        isChildcareService(
          serviceSlug
            ? serviceBySlug.get(serviceSlug)
            : undefined
        ) &&
        peopleCount == null
      ) {
        if (memory.childrenCount > 0) {
          peopleCount = memory.childrenCount;
          memoryFields.push("children_count");
        } else {
          const rememberedChildren = detectChildren(
            memory.householdNotes ?? ""
          );

          if (rememberedChildren != null) {
            peopleCount = rememberedChildren;
            memoryFields.push("household_notes");
          }
        }
      }
    }

    if (
      serviceSlug &&
      !serviceBySlug.has(serviceSlug)
    ) {
      serviceSlug = null;
    }

    const partial = {
      serviceSlug,
      city,
      requestedDay,
      requestedTime,
    };

    const missingFields =
      missingFieldsForRequest(partial);
    const matchedService = serviceSlug
      ? serviceBySlug.get(serviceSlug)
      : undefined;
    const memoryUsed = memoryFields.length > 0;

    const parsed: AnalyzedUniversalRequest = {
      serviceSlug,
      serviceLabel: matchedService
        ? matchedService.name?.trim() || matchedService.slug
        : null,
      serviceCandidates: candidates,
      serviceAmbiguous,
      serviceConfidenceGap: decision.confidenceGap,
      clarificationCandidates,
      serviceClarificationMessage: serviceAmbiguous
        ? clarificationMessage(clarificationCandidates)
        : null,
      city,
      requestedDay,
      requestedTime,
      durationHours,
      budgetMax,
      peopleCount,
      urgency: urgencyFromText(text),
      memoryUsed,
      memoryMessage: memoryUsed
        ? "KLYX a complété uniquement les informations autorisées dans ta mémoire."
        : null,
      missingFields,
      readyForSearch:
        !serviceAmbiguous && missingFields.length === 0,
    };

    const { data: serviceRequest, error } =
      await supabaseAdmin
        .from("service_requests")
        .insert({
          user_id: profile.id,
          raw_text: text,
          detected_service_slug: parsed.serviceSlug,
          city: parsed.city,
          requested_day: parsed.requestedDay,
          requested_time: parsed.requestedTime,
          budget_max: parsed.budgetMax,
          people_count: parsed.peopleCount,
          urgency: parsed.urgency,
          parsed_payload: {
            ...parsed,
            memoryFields,
          },
          status: parsed.readyForSearch
            ? "ready"
            : "analyzed",
        })
        .select("id")
        .single();

    if (error) throw new Error(error.message);

    if (memoryUsed) {
      await recordClientMemoryUsage({
        profileId: profile.id,
        surface: "request_analysis",
        usedFields: memoryFields,
        referenceId: serviceRequest.id,
      });
    }

    return NextResponse.json({
      requestId: serviceRequest.id,
      parsed: {
        ...parsed,
        memoryFields,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Analyse impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

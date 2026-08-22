import {
  detectBudget,
  detectCity,
  detectDurationHours,
  detectRequestedDay,
  detectRequestedTime,
  detectServiceCandidates,
  missingFieldsForRequest,
  wantsMemory,
  type ServiceCandidate,
} from "@/lib/universal-service-request";

export type AgentStepStatus =
  | "pending"
  | "ready"
  | "completed";

export type AgentStep = {
  id:
    | "understand"
    | "complete"
    | "search"
    | "choose"
    | "book"
    | "pay";
  title: string;
  description: string;
  status: AgentStepStatus;
  actionHref: string | null;
  requiresConfirmation: boolean;
};

export type AgentPlanInput = {
  request: string;
  serviceCandidates?: ServiceCandidate[];
  memory?: {
    enabled: boolean;
    defaultCity: string | null;
    defaultBudget: number | null;
    preferredServiceSlugs: string[];
    preferredTimeText: string | null;
  };
};

export type AgentPlanResult = {
  title: string;
  serviceSlug: string | null;
  serviceLabel: string | null;
  city: string | null;
  requestedDay: string | null;
  requestedTime: string | null;
  durationHours: number | null;
  budgetMax: number | null;
  memoryUsed: boolean;
  memoryFields: string[];
  missingFields: string[];
  readyForSearch: boolean;
  searchHref: string | null;
  steps: AgentStep[];
};

function buildSearchHref(
  serviceSlug: string,
  city: string,
  date: string,
  time: string,
  durationHours: number | null,
  budgetMax: number | null,
  request: string
): string {
  const params = new URLSearchParams({
    service: serviceSlug,
    city,
    date,
    time: time.slice(0, 5),
    duration: String(durationHours ?? 1),
    q: request.slice(0, 240),
  });

  if (budgetMax != null) {
    params.set("budget", String(budgetMax));
  }

  return `/search?${params.toString()}`;
}

export function buildClientAgentPlan(
  input: AgentPlanInput
): AgentPlanResult {
  const request = input.request.trim();
  const candidates =
    input.serviceCandidates ?? detectServiceCandidates(request);

  let serviceSlug =
    candidates[0]?.confidence >= 60
      ? candidates[0].slug
      : null;
  let serviceLabel =
    candidates[0]?.confidence >= 60
      ? candidates[0].label
      : null;
  let city = detectCity(request);
  const requestedDay = detectRequestedDay(request);
  let requestedTime = detectRequestedTime(request);
  const durationHours = detectDurationHours(request);
  let budgetMax = detectBudget(request);
  const memoryFields: string[] = [];

  if (
    wantsMemory(request) &&
    input.memory?.enabled
  ) {
    if (!serviceSlug && input.memory.preferredServiceSlugs[0]) {
      serviceSlug = input.memory.preferredServiceSlugs[0];
      memoryFields.push("preferred_service_slugs");
    }

    if (!city && input.memory.defaultCity) {
      city = input.memory.defaultCity;
      memoryFields.push("default_city");
    }

    if (budgetMax == null && input.memory.defaultBudget != null) {
      budgetMax = input.memory.defaultBudget;
      memoryFields.push("default_budget");
    }

    if (!requestedTime) {
      const rememberedTime = detectRequestedTime(
        input.memory.preferredTimeText ?? ""
      );

      if (rememberedTime) {
        requestedTime = rememberedTime;
        memoryFields.push("scheduling_notes");
      }
    }
  }

  if (
    serviceSlug &&
    !serviceLabel
  ) {
    const candidate = candidates.find(
      (item) => item.slug === serviceSlug
    );
    serviceLabel = candidate?.label ?? serviceSlug;
  }

  const missingFields = missingFieldsForRequest({
    serviceSlug,
    city,
    requestedDay,
    requestedTime,
  });

  const readyForSearch = missingFields.length === 0;

  const searchHref =
    readyForSearch &&
    serviceSlug &&
    city &&
    requestedDay &&
    requestedTime
      ? buildSearchHref(
          serviceSlug,
          city,
          requestedDay,
          requestedTime,
          durationHours,
          budgetMax,
          request
        )
      : null;

  const steps: AgentStep[] = [
    {
      id: "understand",
      title: "Comprendre le besoin",
      description:
        "KLYX transforme ta phrase en informations structurées.",
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
    },
    {
      id: "complete",
      title: "Compléter les informations",
      description:
        missingFields.length > 0
          ? `Il manque : ${missingFields.join(", ")}.`
          : "Toutes les informations nécessaires sont présentes.",
      status:
        missingFields.length > 0
          ? "ready"
          : "completed",
      actionHref:
        missingFields.length > 0
          ? "/request"
          : null,
      requiresConfirmation: true,
    },
    {
      id: "search",
      title: "Comparer les prestataires",
      description:
        readyForSearch
          ? "KLYX peut rechercher automatiquement les prestataires compatibles."
          : "Cette étape sera disponible après avoir complété la demande.",
      status: readyForSearch ? "ready" : "pending",
      actionHref: searchHref,
      requiresConfirmation: false,
    },
    {
      id: "choose",
      title: "Choisir le prestataire",
      description:
        "KLYX peut sélectionner le meilleur match exact. S’il n’y en a pas, tu gardes le choix parmi les alternatives.",
      status: "pending",
      actionHref: null,
      requiresConfirmation: false,
    },
    {
      id: "book",
      title: "Confirmer la réservation",
      description:
        "La date, l’heure et la prestation doivent être confirmées manuellement.",
      status: "pending",
      actionHref: null,
      requiresConfirmation: true,
    },
    {
      id: "pay",
      title: "Confirmer le paiement",
      description:
        "KLYX ne déclenche jamais le paiement sans ton clic final.",
      status: "pending",
      actionHref: null,
      requiresConfirmation: true,
    },
  ];

  return {
    title: serviceLabel
      ? `Organiser un service de ${serviceLabel.toLowerCase()}`
      : "Organiser un service quotidien",
    serviceSlug,
    serviceLabel,
    city,
    requestedDay,
    requestedTime,
    durationHours,
    budgetMax,
    memoryUsed: memoryFields.length > 0,
    memoryFields,
    missingFields,
    readyForSearch,
    searchHref,
    steps,
  };
}

import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

type SuggestedService = {
  slug: string;
  label: string;
  position: number;
  estimatedPriceMin: number | null;
  estimatedPriceMax: number | null;
  notes: string;
};

type ProjectPlan = {
  title: string;
  projectType: string;
  city: string | null;
  targetDate: string | null;
  budgetMax: number | null;
  services: SuggestedService[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function detectCity(text: string): string | null {
  const cities = [
    "Bruxelles",
    "Anderlecht",
    "Schaerbeek",
    "Ixelles",
    "Uccle",
    "Etterbeek",
    "Forest",
    "Saint-Gilles",
    "Molenbeek-Saint-Jean",
    "Jette",
    "Evere",
    "Louvain",
    "Anvers",
    "Gand",
    "Liège",
    "Namur",
    "Charleroi",
    "Mons",
  ];

  const normalized = normalize(text);

  return (
    cities.find((city) =>
      normalized.includes(normalize(city))
    ) ?? null
  );
}

function detectDate(text: string): string | null {
  const match = text.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/
  );

  if (!match) {
    return null;
  }

  const now = new Date();
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : now.getFullYear();

  if (year < 100) {
    year += 2000;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function detectBudget(text: string): number | null {
  const match = text.match(
    /(?:budget(?:\s*(?:max(?:imum)?|de))?\s*[:=]?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i
  );

  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));

  return Number.isFinite(value) ? value : null;
}

function buildProjectPlan(description: string): ProjectPlan {
  const normalized = normalize(description);
  const city = detectCity(description);
  const targetDate = detectDate(description);
  const budgetMax = detectBudget(description);

  if (
    normalized.includes("demenage") ||
    normalized.includes("demenagement")
  ) {
    return {
      title: "Projet déménagement",
      projectType: "moving",
      city,
      targetDate,
      budgetMax,
      services: [
        {
          slug: "moving",
          label: "Déménagement",
          position: 1,
          estimatedPriceMin: 250,
          estimatedPriceMax: 900,
          notes:
            "Transport des meubles et cartons selon le volume et la distance.",
        },
        {
          slug: "handyman",
          label: "Bricolage",
          position: 2,
          estimatedPriceMin: 80,
          estimatedPriceMax: 300,
          notes:
            "Démontage, remontage et petites installations.",
        },
        {
          slug: "cleaning",
          label: "Ménage",
          position: 3,
          estimatedPriceMin: 70,
          estimatedPriceMax: 250,
          notes:
            "Nettoyage du logement avant ou après le déménagement.",
        },
      ],
    };
  }

  if (
    normalized.includes("anniversaire") ||
    normalized.includes("fete")
  ) {
    return {
      title: "Projet événement",
      projectType: "event",
      city,
      targetDate,
      budgetMax,
      services: [
        {
          slug: "babysitting",
          label: "Baby-sitting",
          position: 1,
          estimatedPriceMin: 60,
          estimatedPriceMax: 180,
          notes:
            "Garde des enfants pendant l’événement.",
        },
        {
          slug: "cleaning",
          label: "Ménage",
          position: 2,
          estimatedPriceMin: 80,
          estimatedPriceMax: 220,
          notes:
            "Nettoyage après l’événement.",
        },
      ],
    };
  }

  if (
    normalized.includes("renove") ||
    normalized.includes("renovation") ||
    normalized.includes("salle de bain")
  ) {
    return {
      title: "Projet rénovation",
      projectType: "renovation",
      city,
      targetDate,
      budgetMax,
      services: [
        {
          slug: "handyman",
          label: "Bricolage",
          position: 1,
          estimatedPriceMin: 150,
          estimatedPriceMax: 1200,
          notes:
            "Travaux de montage, réparation et finitions.",
        },
        {
          slug: "cleaning",
          label: "Ménage",
          position: 2,
          estimatedPriceMin: 90,
          estimatedPriceMax: 300,
          notes:
            "Nettoyage de fin de chantier.",
        },
      ],
    };
  }

  return {
    title: "Nouveau projet KLYX",
    projectType: "custom",
    city,
    targetDate,
    budgetMax,
    services: [
      {
        slug: "babysitting",
        label: "Baby-sitting",
        position: 1,
        estimatedPriceMin: null,
        estimatedPriceMax: null,
        notes:
          "Service proposé à confirmer selon le besoin.",
      },
      {
        slug: "cleaning",
        label: "Ménage",
        position: 2,
        estimatedPriceMin: null,
        estimatedPriceMax: null,
        notes:
          "Service proposé à confirmer selon le besoin.",
      },
      {
        slug: "moving",
        label: "Déménagement",
        position: 3,
        estimatedPriceMin: null,
        estimatedPriceMax: null,
        notes:
          "Service proposé à confirmer selon le besoin.",
      },
      {
        slug: "handyman",
        label: "Bricolage",
        position: 4,
        estimatedPriceMin: null,
        estimatedPriceMax: null,
        notes:
          "Service proposé à confirmer selon le besoin.",
      },
    ],
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      description?: string;
    };

    const description = body.description?.trim();

    if (!description) {
      return NextResponse.json(
        {
          error:
            "Décris le projet que tu veux organiser.",
        },
        { status: 400 }
      );
    }

    const plan = buildProjectPlan(description);

    const { data: project, error: projectError } =
      await supabaseAdmin
        .from("projects")
        .insert({
          user_id: profile.id,
          title: plan.title,
          description,
          project_type: plan.projectType,
          city: plan.city,
          target_date: plan.targetDate,
          budget_max: plan.budgetMax,
          status: "planned",
        })
        .select(
          "id, title, description, project_type, city, target_date, budget_max, status, created_at"
        )
        .single();

    if (projectError) {
      throw projectError;
    }

    const { data: services, error: servicesError } =
      await supabaseAdmin
        .from("project_services")
        .insert(
          plan.services.map((service) => ({
            project_id: project.id,
            service_slug: service.slug,
            service_label: service.label,
            position: service.position,
            estimated_price_min:
              service.estimatedPriceMin,
            estimated_price_max:
              service.estimatedPriceMax,
            notes: service.notes,
            status: "suggested",
          }))
        )
        .select(
          "id, service_slug, service_label, position, estimated_price_min, estimated_price_max, notes, status"
        );

    if (servicesError) {
      throw servicesError;
    }

    return NextResponse.json({
      project,
      services: services ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer le projet.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "project_plan_create_failed",
      route: "/api/projects/plan",
      method: "POST",
      status,
      code: "KLYX_PROJECT_PLAN_CREATE_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

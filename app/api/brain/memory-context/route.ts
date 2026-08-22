import { NextResponse } from "next/server";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { loadClientMemoryContext } from "@/lib/client-memory-context";

const SERVICE_LABELS: Record<string, string> = {
  babysitting: "baby-sitting",
  cleaning: "ménage",
  moving: "déménagement",
  handyman: "bricolage",
  "menage-a-domicile": "ménage",
};

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const memory = await loadClientMemoryContext(profile.id);

    if (!memory.enabled) {
      return NextResponse.json({
        enabled: false,
        available: false,
        summary: [],
        quickRequests: [],
      });
    }

    const summary: {
      key: string;
      label: string;
      value: string;
    }[] = [];

    if (memory.defaultCity) {
      summary.push({
        key: "city",
        label: "Ville habituelle",
        value: memory.defaultCity,
      });
    }

    if (memory.defaultBudget != null) {
      summary.push({
        key: "budget",
        label: "Budget habituel",
        value: `${memory.defaultBudget} € maximum`,
      });
    }

    if (memory.preferredServiceSlugs.length > 0) {
      summary.push({
        key: "services",
        label: "Services préférés",
        value: memory.preferredServiceSlugs
          .map((slug) => SERVICE_LABELS[slug] ?? slug)
          .join(", "),
      });
    }

    if (memory.childrenCount > 0) {
      summary.push({
        key: "children",
        label: "Foyer",
        value: `${memory.childrenCount} enfant(s)`,
      });
    }

    if (memory.petTypes.length > 0) {
      summary.push({
        key: "pets",
        label: "Animaux",
        value: memory.petTypes.join(", "),
      });
    }

    if (memory.preferredLanguages.length > 0) {
      summary.push({
        key: "languages",
        label: "Langues préférées",
        value: memory.preferredLanguages.join(", "),
      });
    }

    const quickRequests = memory.preferredServiceSlugs
      .slice(0, 4)
      .map((slug) => ({
        serviceSlug: slug,
        label: `Organiser mon ${SERVICE_LABELS[slug] ?? slug}`,
        message: `Je veux organiser un service de ${
          SERVICE_LABELS[slug] ?? slug
        } comme d’habitude.`,
      }));

    return NextResponse.json({
      enabled: true,
      available: memory.available,
      summary,
      quickRequests,
      privacyNotice:
        "KLYX utilise ces habitudes uniquement quand tu le demandes. Le prestataire ne reçoit pas toute ta mémoire.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger le contexte mémoire.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

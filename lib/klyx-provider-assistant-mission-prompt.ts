import type { KlyxLocale } from "@/lib/klyx-i18n";
import { resolveKlyxProviderAssistantLocale } from "@/lib/klyx-provider-assistant-i18n";

type MissionPromptContext = {
  title: string;
  service: string;
  city: string;
  budget: string;
  description: string;
  matchScore: number;
};

type PromptLabels = {
  instruction: string;
  mission: string;
  service: string;
  city: string;
  budget: string;
  description: string;
  compatibility: string;
  control: string;
};

const LABELS: Record<"fr" | "en" | "nl" | "de", PromptLabels> = {
  fr: {
    instruction: "Prépare une réponse professionnelle pour cette mission KLYX.",
    mission: "Mission",
    service: "Service",
    city: "Ville",
    budget: "Budget client",
    description: "Description",
    compatibility: "Compatibilité KLYX",
    control: "Je veux relire et modifier le brouillon avant toute action.",
  },
  en: {
    instruction: "Prepare a professional reply for this KLYX job.",
    mission: "Job",
    service: "Service",
    city: "City",
    budget: "Client budget",
    description: "Description",
    compatibility: "KLYX compatibility",
    control: "I want to review and edit the draft before any action.",
  },
  nl: {
    instruction: "Bereid een professioneel antwoord voor deze KLYX-opdracht voor.",
    mission: "Opdracht",
    service: "Dienst",
    city: "Plaats",
    budget: "Klantbudget",
    description: "Beschrijving",
    compatibility: "KLYX-compatibiliteit",
    control: "Ik wil het concept controleren en aanpassen vóór elke actie.",
  },
  de: {
    instruction: "Bereite eine professionelle Antwort für diesen KLYX-Auftrag vor.",
    mission: "Auftrag",
    service: "Service",
    city: "Ort",
    budget: "Kundenbudget",
    description: "Beschreibung",
    compatibility: "KLYX-Übereinstimmung",
    control: "Ich möchte den Entwurf vor jeder Aktion prüfen und bearbeiten.",
  },
};

export function buildKlyxProviderAssistantMissionPrompt(
  locale: KlyxLocale | string,
  context: MissionPromptContext
): string {
  const labels = LABELS[resolveKlyxProviderAssistantLocale(locale)];

  return [
    labels.instruction,
    `${labels.mission}: ${context.title}`,
    `${labels.service}: ${context.service}`,
    `${labels.city}: ${context.city}`,
    `${labels.budget}: ${context.budget}`,
    `${labels.description}: ${context.description}`,
    `${labels.compatibility}: ${context.matchScore}%.`,
    labels.control,
  ].join("\n");
}

import {
  hasGeneralBrainCommandIntent,
  hasNewNeedBrainCommandIntent,
  hasSpecificBrainCommandIntent,
  normalizeBrainCommandMessage,
} from "@/lib/brain-command-intent";

export type KlyxAssistantIntent =
  | "service_need"
  | "income_search"
  | "mission_management"
  | "information"
  | "clarification";

export type KlyxAssistantIntentResult = {
  intent: KlyxAssistantIntent;
  confidence: "high" | "medium";
  normalizedMessage: string;
  clarificationQuestion: string | null;
};

const INCOME_SIGNALS = [
  "gagner",
  "revenu",
  "objectif de revenu",
  "je suis libre",
  "je suis disponible",
  "missions a faire",
  "missions a prendre",
  "trouver des missions",
  "cherche des missions",
  "trouve moi des missions",
  "du travail",
  "du boulot",
  "earn",
  "income",
  "make money",
  "i am free",
  "i m free",
  "i am available",
  "find jobs",
  "find work",
  "jobs near me",
  "verdienen",
  "inkomen",
  "beschikbaar",
  "opdrachten vinden",
  "werk vinden",
  "einkommen",
  "verfugbar",
  "auftrage finden",
  "arbeit finden",
] as const;

const INCOME_NOUNS = [
  "mission",
  "missions",
  "travail",
  "boulot",
  "job",
  "jobs",
  "work",
  "opdracht",
  "opdrachten",
  "werk",
  "auftrag",
  "auftrage",
  "arbeit",
] as const;

const AVAILABILITY_SIGNALS = [
  "je suis libre",
  "je suis disponible",
  "disponible samedi",
  "libre samedi",
  "i am free",
  "i m free",
  "i am available",
  "beschikbaar",
  "verfugbar",
] as const;

const INFORMATION_SIGNALS = [
  "comment",
  "pourquoi",
  "c est quoi",
  "qu est ce que",
  "que signifie",
  "est ce que",
  "peux tu m expliquer",
  "bonjour",
  "salut",
  "bonsoir",
  "how",
  "why",
  "what is",
  "what does",
  "can you explain",
  "hello",
  "hi",
  "hoe",
  "waarom",
  "wat is",
  "hallo",
  "wie",
  "warum",
  "was ist",
] as const;

const GENERIC_AMBIGUOUS = new Set([
  "mission",
  "une mission",
  "je veux une mission",
  "travail",
  "du travail",
  "job",
  "a job",
  "work",
  "opdracht",
  "werk",
  "auftrag",
  "arbeit",
]);

function includesAny(value: string, signals: readonly string[]) {
  return signals.some((signal) => value.includes(signal));
}

function hasMoneyTarget(value: string) {
  return /(?:^|\s)(?:€|\$|£)?\s*\d{1,6}(?:[.,]\d{1,2})?\s*(?:€|eur|euros?|\$|usd|£|gbp)?(?:\s|$)/i.test(
    value
  );
}

function hasIncomeIntent(value: string) {
  const explicitIncome = includesAny(value, INCOME_SIGNALS);
  const availableForWork =
    includesAny(value, AVAILABILITY_SIGNALS) &&
    includesAny(value, INCOME_NOUNS);

  return explicitIncome || availableForWork;
}

function hasInformationIntent(value: string) {
  return (
    value.endsWith("?") ||
    includesAny(value, INFORMATION_SIGNALS)
  );
}

export function classifyKlyxAssistantIntent(
  rawMessage: string
): KlyxAssistantIntentResult {
  const normalizedMessage = normalizeBrainCommandMessage(rawMessage);

  if (!normalizedMessage) {
    return {
      intent: "clarification",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion: "Que voulez-vous obtenir ou organiser ?",
    };
  }

  const serviceNeed = hasNewNeedBrainCommandIntent(normalizedMessage);
  const incomeSearch = hasIncomeIntent(normalizedMessage);
  const missionManagement =
    hasSpecificBrainCommandIntent(normalizedMessage) ||
    hasGeneralBrainCommandIntent(normalizedMessage);

  if (serviceNeed && incomeSearch) {
    return {
      intent: "clarification",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion:
        "Vous voulez trouver quelqu’un pour vous aider, ou trouver une mission à réaliser ?",
    };
  }

  if (missionManagement && !incomeSearch) {
    return {
      intent: "mission_management",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion: null,
    };
  }

  if (incomeSearch) {
    return {
      intent: "income_search",
      confidence:
        hasMoneyTarget(rawMessage) || includesAny(normalizedMessage, AVAILABILITY_SIGNALS)
          ? "high"
          : "medium",
      normalizedMessage,
      clarificationQuestion: null,
    };
  }

  if (serviceNeed) {
    return {
      intent: "service_need",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion: null,
    };
  }

  if (GENERIC_AMBIGUOUS.has(normalizedMessage)) {
    return {
      intent: "clarification",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion:
        "Vous cherchez quelqu’un pour un besoin, ou une mission à réaliser pour gagner de l’argent ?",
    };
  }

  if (hasInformationIntent(rawMessage.toLowerCase())) {
    return {
      intent: "information",
      confidence: "high",
      normalizedMessage,
      clarificationQuestion: null,
    };
  }

  return {
    intent: "clarification",
    confidence: "medium",
    normalizedMessage,
    clarificationQuestion:
      "Vous voulez obtenir un service, trouver une mission, ou gérer une mission existante ?",
  };
}

import "server-only";

import {
  generateKlyxAiReply,
  type KlyxAiMode,
} from "@/lib/klyx-ai";
import {
  assessKlyxVisibleAiCandidate,
} from "@/lib/klyx-visible-ai-safety";

type VisibleAiAccountType = "client" | "provider";

type VisibleAiInput = {
  message: string;
  deterministicReply: string;
  accountType: VisibleAiAccountType;
  lockedFacts?: Record<string, unknown> | null;
  requiredTail?: string | null;
  suppressAiQuestions?: boolean;
};

export type KlyxVisibleAiReply = {
  mode: KlyxAiMode;
  text: string;
};

function serializeLockedFacts(
  value: Record<string, unknown> | null | undefined
): string {
  if (!value) return "{}";

  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function withoutQuestions(value: string): string {
  const sentences = value.match(/[^.!?]+[.!?]?/g) ?? [value];

  return sentences
    .filter((sentence) => !sentence.includes("?"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gives KLYX a visible conversational layer without giving the LLM authority
 * over transactional facts or actions. The deterministic application result
 * remains the source of truth and is always the fallback.
 */
export async function generateKlyxVisibleAiReply(
  input: VisibleAiInput
): Promise<KlyxVisibleAiReply> {
  const deterministicReply = input.deterministicReply.trim();

  if (!deterministicReply) {
    return {
      mode: "fallback",
      text: deterministicReply,
    };
  }

  const lockedFacts = serializeLockedFacts(input.lockedFacts);
  const requiredTail = input.requiredTail?.trim() ?? "";
  const ai = await generateKlyxAiReply({
    accountType: input.accountType,
    message: [
      "Tu reformules une réponse KLYX déjà validée par le code métier.",
      "Ta seule mission est de la rendre plus naturelle, claire et humaine.",
      "Règles non négociables :",
      "- ne change aucun fait verrouillé ;",
      "- ne change aucun montant, date, heure, lieu, statut ou action ;",
      "- n'ajoute aucun prestataire, prix, disponibilité ou résultat système ;",
      "- ne prétends jamais qu'une action a été exécutée ;",
      "- conserve toute demande de confirmation explicite ;",
      input.suppressAiQuestions
        ? "- ne pose aucune question : KLYX ajoutera lui-même la question ou la confirmation obligatoire ;"
        : "- pose au maximum une seule question si la réponse validée en contient une ;",
      "- reste bref.",
      "",
      `Message utilisateur : ${input.message.trim().slice(0, 1200)}`,
      `Faits KLYX verrouillés : ${lockedFacts.slice(0, 1400)}`,
      `Réponse KLYX validée : ${deterministicReply.slice(0, 1400)}`,
      requiredTail
        ? `Bloc obligatoire ajouté par KLYX après ta reformulation : ${requiredTail.slice(0, 700)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (ai.mode !== "openai" || !ai.text.trim()) {
    return {
      mode: "fallback",
      text: deterministicReply,
    };
  }

  const conversationalText = input.suppressAiQuestions
    ? withoutQuestions(ai.text)
    : ai.text.trim();

  if (!conversationalText) {
    return {
      mode: "fallback",
      text: deterministicReply,
    };
  }

  const safety = assessKlyxVisibleAiCandidate({
    candidate: conversationalText,
    deterministicReply,
    lockedFacts: input.lockedFacts,
  });

  if (!safety.safe) {
    return {
      mode: "fallback",
      text: deterministicReply,
    };
  }

  const text =
    requiredTail && !conversationalText.endsWith(requiredTail)
      ? `${conversationalText}\n\n${requiredTail}`
      : conversationalText;

  return {
    mode: "openai",
    text,
  };
}

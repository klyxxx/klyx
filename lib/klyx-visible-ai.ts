import "server-only";

import {
  generateKlyxAiReply,
  type KlyxAiMode,
} from "@/lib/klyx-ai";

type VisibleAiAccountType = "client" | "provider";

type VisibleAiInput = {
  message: string;
  deterministicReply: string;
  accountType: VisibleAiAccountType;
  lockedFacts?: Record<string, unknown> | null;
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
      "- pose au maximum une seule question si la réponse validée en contient une ;",
      "- reste bref.",
      "",
      `Message utilisateur : ${input.message.trim().slice(0, 1200)}`,
      `Faits KLYX verrouillés : ${lockedFacts.slice(0, 1400)}`,
      `Réponse KLYX validée : ${deterministicReply.slice(0, 1400)}`,
    ].join("\n"),
  });

  if (ai.mode !== "openai" || !ai.text.trim()) {
    return {
      mode: "fallback",
      text: deterministicReply,
    };
  }

  return {
    mode: "openai",
    text: ai.text.trim(),
  };
}

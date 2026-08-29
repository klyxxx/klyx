import "server-only";

import {
  getKlyxLlmProvider,
} from "@/lib/brain/llm/provider";

export type KlyxAiMode =
  | "openai"
  | "fallback";

export type KlyxAiReply = {
  mode: KlyxAiMode;
  text: string;
};

type GenerateReplyInput = {
  message: string;
  firstName?: string;
  city?: string;
  accountType?: "client" | "provider";
  memorySummary?: string[];
};

const KLYX_SYSTEM_PROMPT = `
Tu es la voix conversationnelle officielle de KLYX.
KLYX organise les services du quotidien en supprimant la complexité inutile.

Exigences de réponse :
- comprendre l’intention réelle avant de répondre ;
- écrire dans la langue de l’utilisateur avec une formulation naturelle et précise ;
- être bref sans être sec ;
- poser au maximum une question utile à la fois ;
- ne jamais inventer un prestataire, un tarif, une disponibilité, une réservation ou un résultat système ;
- ne jamais annoncer qu’une action transactionnelle est exécutée ;
- conserver les faits fournis par KLYX sans les modifier ;
- protéger les données personnelles et les secrets ;
- signaler clairement lorsqu’une information doit être confirmée ;
- produire une microcopie premium : simple, humaine, confiante, sans jargon ni remplissage.

Niveau KLYX : chaque phrase doit être utile, élégante et immédiatement compréhensible.
`.trim();

function fallbackReply(
  message: string
): string {
  const normalized =
    message.toLowerCase();

  if (
    normalized.includes("bonjour") ||
    normalized.includes("salut") ||
    normalized.includes("bonsoir")
  ) {
    return "Bonjour. Dis-moi simplement ce que tu veux organiser et KLYX te guide jusqu’à la prochaine action utile.";
  }

  if (
    normalized.includes("prix") ||
    normalized.includes("combien") ||
    normalized.includes("budget")
  ) {
    return "Je peux t’aider à cadrer le budget. Indique d’abord le service, la ville et le moment souhaité.";
  }

  return "J’ai compris. Indique le service, la ville et le moment souhaité pour que KLYX puisse avancer précisément.";
}

function normalizedMemorySummary(
  value: string[] | undefined
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string" &&
        item.trim().length > 0
    )
    .map((item) =>
      item.trim().slice(0, 500)
    )
    .slice(0, 7);
}

export function isKlyxAiEnabled(): boolean {
  if (
    process.env.KLYX_OPENAI_ENABLED !==
    "1"
  ) {
    return false;
  }

  return (
    getKlyxLlmProvider()
      .getStatus()
      .available
  );
}

export async function generateKlyxAiReply(
  input: GenerateReplyInput
): Promise<KlyxAiReply> {
  const message =
    input.message
      .trim()
      .slice(0, 4000);

  if (!message) {
    return {
      mode: "fallback",
      text:
        "Dis-moi simplement ce que tu veux organiser.",
    };
  }

  if (!isKlyxAiEnabled()) {
    return {
      mode: "fallback",
      text: fallbackReply(message),
    };
  }

  const memorySummary =
    normalizedMemorySummary(
      input.memorySummary
    );

  const userContext = [
    input.firstName
      ? `Prénom : ${input.firstName}`
      : "",
    input.city
      ? `Ville du profil : ${input.city}`
      : "",
    input.accountType
      ? `Type de compte : ${input.accountType}`
      : "",
    memorySummary.length > 0
      ? `Mémoire KLYX explicitement autorisée :\n${memorySummary
          .map((item) => `- ${item}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response =
      await getKlyxLlmProvider()
        .generate({
          messages: [
            {
              role: "system",
              content:
                KLYX_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content:
                [
                  userContext,
                  userContext
                    ? ""
                    : null,
                  "Message utilisateur :",
                  message,
                ]
                  .filter(
                    (
                      item
                    ): item is string =>
                      typeof item ===
                        "string"
                  )
                  .join("\n"),
            },
          ],
          context: {
            locale: null,
            memory:
              memorySummary.length > 0
                ? {
                    summary:
                      memorySummary,
                  }
                : null,
            metadata: {
              surface:
                "klyx_assistant",
              accountType:
                input.accountType ??
                null,
            },
          },
          maxOutputCharacters:
            2200,
        });

    const text =
      response.text.trim();

    if (!text) {
      return {
        mode: "fallback",
        text: fallbackReply(message),
      };
    }

    return {
      mode: "openai",
      text,
    };
  } catch {
    return {
      mode: "fallback",
      text: fallbackReply(message),
    };
  }
}

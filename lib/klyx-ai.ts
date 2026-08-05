import "server-only";

export type KlyxAiMode = "openai" | "fallback";

export type KlyxAiReply = {
  mode: KlyxAiMode;
  text: string;
};

type GenerateReplyInput = {
  message: string;
  firstName?: string;
  city?: string;
  accountType?: "client" | "provider";
};

const KLYX_SYSTEM_PROMPT = `
Tu es l’assistant officiel de KLYX, une plateforme de services du quotidien.

Ton objectif est de faire disparaître la complexité :
- comprendre le besoin réel de l’utilisateur ;
- répondre en français clair, naturel et rassurant ;
- poser au maximum une question utile à la fois ;
- éviter les longs textes ;
- ne jamais inventer un prestataire, un prix, une disponibilité ou une réservation ;
- distinguer ce que KLYX sait déjà de ce qui doit encore être confirmé ;
- proposer l’action suivante la plus simple ;
- ne jamais confirmer un paiement, remboursement ou rendez-vous sans résultat réel du système ;
- ne jamais donner de conseil médical, juridique ou financier personnalisé comme une certitude ;
- signaler lorsqu’un métier peut être réglementé ;
- protéger les données personnelles et les secrets.

Style KLYX :
minimaliste, élégant, intuitif, rapide, rassurant, intelligent, premium et cohérent.

Quand l’utilisateur décrit un besoin de service, cherche à identifier :
le service, la ville, la date, l’heure, le budget et les contraintes importantes.

Réponds sans markdown complexe. Utilise des paragraphes courts.
`.trim();

function fallbackReply(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("bonjour") ||
    normalized.includes("salut") ||
    normalized.includes("bonsoir")
  ) {
    return "Bonjour. Décris simplement ce dont tu as besoin, par exemple : « Je cherche quelqu’un pour nettoyer mon appartement demain à Bruxelles. »";
  }

  if (
    normalized.includes("prix") ||
    normalized.includes("combien") ||
    normalized.includes("budget")
  ) {
    return "Je peux t’aider à comparer les prix, mais je dois d’abord connaître le service, la ville et la date souhaitée.";
  }

  return "J’ai compris ta demande. Pour trouver la meilleure solution, indique le service recherché, la ville et le moment souhaité.";
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string") {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = Array.isArray(
      (item as Record<string, unknown>).content
    )
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;

      const text = (part as Record<string, unknown>).text;

      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }

  return "";
}

export function isKlyxAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateKlyxAiReply(
  input: GenerateReplyInput
): Promise<KlyxAiReply> {
  const message = input.message.trim().slice(0, 4000);

  if (!message) {
    return {
      mode: "fallback",
      text: "Décris simplement ce dont tu as besoin.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      mode: "fallback",
      text: fallbackReply(message),
    };
  }

  const userContext = [
    input.firstName ? `Prénom : ${input.firstName}` : "",
    input.city ? `Ville du profil : ${input.city}` : "",
    input.accountType ? `Type de compte : ${input.accountType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.KLYX_OPENAI_MODEL?.trim() || "gpt-5-mini",
        instructions: KLYX_SYSTEM_PROMPT,
        input: `${userContext}\n\nMessage utilisateur :\n${message}`,
        max_output_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return {
        mode: "fallback",
        text: fallbackReply(message),
      };
    }

    const payload = (await response.json()) as unknown;
    const text = extractOutputText(payload);

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

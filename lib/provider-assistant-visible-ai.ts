import {
  assessKlyxVisibleAiCandidate,
} from "./klyx-visible-ai-safety";

type ProviderUnknownAiMode = "openai" | "fallback";

type FinalizeProviderUnknownAiReplyInput = {
  aiMode: ProviderUnknownAiMode;
  candidate: string;
  deterministicReply: string;
  lockedFacts?: Record<string, unknown> | null;
};

export type FinalizedProviderUnknownAiReply = {
  reply: string;
  aiMode: ProviderUnknownAiMode;
};

/**
 * Finalizes the provider's unstructured conversation after its single LLM
 * attempt. The deterministic provider reply remains the source of truth and
 * is returned immediately when the model is unavailable or changes a locked
 * KLYX fact. Unsafe output is never repaired or sent back to the model.
 */
export function finalizeProviderUnknownAiReply(
  input: FinalizeProviderUnknownAiReplyInput
): FinalizedProviderUnknownAiReply {
  const deterministicReply = input.deterministicReply.trim();
  const candidate = input.candidate.trim();

  if (input.aiMode !== "openai" || !candidate) {
    return {
      reply: deterministicReply,
      aiMode: "fallback",
    };
  }

  const safety = assessKlyxVisibleAiCandidate({
    candidate,
    deterministicReply,
    lockedFacts: input.lockedFacts,
  });

  if (!safety.safe) {
    return {
      reply: deterministicReply,
      aiMode: "fallback",
    };
  }

  return {
    reply: candidate,
    aiMode: "openai",
  };
}

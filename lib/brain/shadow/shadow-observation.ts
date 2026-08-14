import type {
  KlyxBrainIntent,
} from "../llm/contracts";

import type {
  KlyxShadowResult,
} from "./llm-shadow";

export type KlyxShadowObservation = {
  timestamp: string;

  source: string;

  expectedIntent:
    KlyxBrainIntent | null;

  shadow: {
    attempted: boolean;

    available: boolean;

    provider: string | null;

    model: string | null;

    intent: KlyxBrainIntent | null;

    confidence: number | null;

    agreementWithExpectedIntent:
      boolean | null;

    automaticExecutionAllowed:
      false;

    error:
      string | null;
  };
};

export function createKlyxShadowObservation(
  source: string,
  expectedIntent: KlyxBrainIntent | null,
  result: KlyxShadowResult,
): KlyxShadowObservation {
  return {
    timestamp:
      new Date().toISOString(),

    source,

    expectedIntent,

    shadow: {
      attempted:
        result.attempted,

      available:
        result.available,

      provider:
        result.provider,

      model:
        result.model,

      intent:
        result.intent,

      confidence:
        result.confidence,

      agreementWithExpectedIntent:
        result.agreementWithExpectedIntent,

      automaticExecutionAllowed:
        false,

      error:
        result.error,
    },
  };
}
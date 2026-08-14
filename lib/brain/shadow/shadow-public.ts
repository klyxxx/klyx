import type {
  KlyxBrainIntent,
} from "../llm/contracts";

export type KlyxPublicShadowStatus = {
  enabled: boolean;

  attempted: boolean;

  available: boolean;

  provider: string | null;

  model: string | null;

  intent: KlyxBrainIntent | null;

  confidence: number | null;

  agreementWithDeterministicBrain:
    boolean | null;

  automaticExecutionAllowed: false;

  internalTextExposed: false;
};

export function createDisabledPublicShadowStatus():
  KlyxPublicShadowStatus {
  return {
    enabled:
      false,

    attempted:
      false,

    available:
      false,

    provider:
      null,

    model:
      null,

    intent:
      null,

    confidence:
      null,

    agreementWithDeterministicBrain:
      null,

    automaticExecutionAllowed:
      false,

    internalTextExposed:
      false,
  };
}
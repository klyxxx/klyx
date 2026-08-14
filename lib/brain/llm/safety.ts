import type {
  KlyxExecutionAction,
  KlyxLlmSafety,
} from "./contracts";

export const KLYX_FORBIDDEN_AUTOMATIC_ACTIONS =
  [
    "publish_market_request",
    "select_provider",
    "create_booking",
    "create_payment",
    "refund_payment",
  ] as const satisfies readonly KlyxExecutionAction[];

export function createKlyxLlmSafety(): KlyxLlmSafety {
  return {
    automaticExecutionAllowed: false,

    requiresExplicitConfirmation: true,

    forbiddenAutomaticActions: [
      ...KLYX_FORBIDDEN_AUTOMATIC_ACTIONS,
    ],
  };
}

export function assertNoAutomaticExecution(
  safety: KlyxLlmSafety,
): void {
  if (safety.automaticExecutionAllowed !== false) {
    throw new Error(
      "KLYX LLM safety violation: automatic execution must remain disabled.",
    );
  }

  if (safety.requiresExplicitConfirmation !== true) {
    throw new Error(
      "KLYX LLM safety violation: explicit confirmation must remain required.",
    );
  }
}
import "server-only";

import type {
  KlyxShadowObservation,
} from "./shadow-observation";

export function logKlyxShadowObservation(
  observation: KlyxShadowObservation,
): void {
  if (
    process.env.KLYX_LLM_SHADOW_LOG !==
    "1"
  ) {
    return;
  }

  console.info(
    "[KLYX_LLM_SHADOW]",
    JSON.stringify(
      observation,
    ),
  );
}
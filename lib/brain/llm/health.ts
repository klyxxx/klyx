import "server-only";

import {
  getKlyxLlmStatus,
} from "./provider";

export type KlyxLlmHealth = {
  enabled: boolean;

  shadowEnabled: boolean;

  shadowLoggingEnabled: boolean;

  provider: string;

  configured: boolean;

  available: boolean;

  model: string | null;

  automaticExecutionAllowed: false;

  explicitConfirmationRequired: true;

  status:
    | "disabled"
    | "ready"
    | "not_configured";
};

export function getKlyxLlmHealth():
  KlyxLlmHealth {
  const provider =
    getKlyxLlmStatus();

  const shadowEnabled =
    process.env.KLYX_LLM_SHADOW_ENABLED ===
    "1";

  const shadowLoggingEnabled =
    process.env.KLYX_LLM_SHADOW_LOG ===
    "1";

  const enabled =
    shadowEnabled &&
    provider.configured &&
    provider.available;

  const status:
    KlyxLlmHealth["status"] =
    !shadowEnabled
      ? "disabled"
      : provider.configured &&
          provider.available
        ? "ready"
        : "not_configured";

  return {
    enabled,

    shadowEnabled,

    shadowLoggingEnabled,

    provider:
      provider.provider,

    configured:
      provider.configured,

    available:
      provider.available,

    model:
      provider.model,

    automaticExecutionAllowed:
      false,

    explicitConfirmationRequired:
      true,

    status,
  };
}
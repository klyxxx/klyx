import {
  NextResponse,
} from "next/server";

import {
  getKlyxLlmHealth,
} from "@/lib/brain/llm/health";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const health =
    getKlyxLlmHealth();

  return NextResponse.json({
    ok:
      true,

    brainMode:
      "deterministic_authoritative",

    llm: {
      enabled:
        health.enabled,

      shadowEnabled:
        health.shadowEnabled,

      shadowLoggingEnabled:
        health.shadowLoggingEnabled,

      provider:
        health.provider,

      configured:
        health.configured,

      available:
        health.available,

      model:
        health.model,

      status:
        health.status,

      automaticExecutionAllowed:
        false,

      explicitConfirmationRequired:
        true,
    },
  });
}
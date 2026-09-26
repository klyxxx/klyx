import type { AssistantIntent } from "@/lib/assistant-intent-router";

export type AssistantEngine =
  | "supabase"
  | "workflow"
  | "matching"
  | "sumsub"
  | "stripe"
  | "twilio"
  | "resend"
  | "tolgee"
  | "llm";

export type AssistantEngineAccess = "read" | "deterministic" | "deferred";

export type AssistantEngineStep = {
  engine: AssistantEngine;
  access: AssistantEngineAccess;
  purpose: string;
};

export const ASSISTANT_SENSITIVE_AUTHORITIES = [
  "payment",
  "kyc",
  "eligibility",
  "settlement",
  "refund",
] as const;

const PLANS: Record<AssistantIntent, readonly AssistantEngineStep[]> = {
  service_need: [
    { engine: "supabase", access: "deterministic", purpose: "conversation_and_request_context" },
    { engine: "workflow", access: "deterministic", purpose: "request_orchestration" },
    { engine: "matching", access: "read", purpose: "service_discovery_and_matching" },
  ],
  income_search: [
    { engine: "supabase", access: "read", purpose: "provider_context" },
    { engine: "matching", access: "read", purpose: "provider_opportunities" },
    { engine: "workflow", access: "deterministic", purpose: "earn_orchestration" },
  ],
  mission_management: [
    { engine: "supabase", access: "read", purpose: "mission_truth" },
    { engine: "workflow", access: "deterministic", purpose: "mission_orchestration" },
    { engine: "twilio", access: "deferred", purpose: "server_authorized_notifications_only" },
    { engine: "resend", access: "deferred", purpose: "server_authorized_notifications_only" },
  ],
  account_help: [
    { engine: "supabase", access: "read", purpose: "account_and_profile_truth" },
  ],
  booking_tracking: [
    { engine: "supabase", access: "read", purpose: "booking_truth" },
  ],
  payment_explanation: [
    { engine: "supabase", access: "read", purpose: "ledger_and_booking_projection" },
    { engine: "stripe", access: "read", purpose: "external_payment_projection_only" },
  ],
  refund_explanation: [
    { engine: "supabase", access: "read", purpose: "refund_and_booking_projection" },
    { engine: "stripe", access: "read", purpose: "external_refund_projection_only" },
  ],
  provider_help: [
    { engine: "supabase", access: "read", purpose: "provider_capabilities_and_readiness" },
    { engine: "workflow", access: "deterministic", purpose: "earn_guidance" },
  ],
  kyc_explanation: [
    { engine: "supabase", access: "read", purpose: "verification_projection" },
    { engine: "sumsub", access: "read", purpose: "external_kyc_projection_only" },
  ],
  locale_change: [
    { engine: "tolgee", access: "deterministic", purpose: "locale_selection" },
  ],
  information: [
    { engine: "supabase", access: "read", purpose: "grounded_product_context_when_needed" },
    { engine: "llm", access: "deferred", purpose: "answer_only_after_deterministic_miss" },
  ],
  clarification: [],
};

export function assistantEnginePlan(
  intent: AssistantIntent
): readonly AssistantEngineStep[] {
  return PLANS[intent];
}

export function assistantIntentMayUseLlm(intent: AssistantIntent): boolean {
  return intent === "information";
}

export function assistantMayDirectlyMutateSensitiveAuthority(
  _authority: (typeof ASSISTANT_SENSITIVE_AUTHORITIES)[number]
): false {
  return false;
}

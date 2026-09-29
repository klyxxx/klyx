import { KLYX_PROVIDER_CATALOG } from "./catalog";
import type { KlyxExternalProviderName } from "./contracts";
import type {
  KlyxProviderControlPlanePolicy,
  KlyxProviderControlPlaneRegistration,
  KlyxProviderFallbackPolicy,
} from "./control-plane-contracts";

const DEFAULT_HEALTH_POLICY = {
  degradedAfterConsecutiveFailures: 2,
  unhealthyAfterConsecutiveFailures: 4,
  blockWhenUnhealthy: false,
} as const;

const DEFAULT_RETRY_POLICY = {
  maxAttempts: 1,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  retryableCodes: ["TIMEOUT", "NETWORK_ERROR", "RATE_LIMITED", "UPSTREAM_5XX"],
} as const;

function fallbackFor(
  provider: KlyxExternalProviderName
): KlyxProviderFallbackPolicy {
  switch (provider) {
    case "openai":
    case "resend":
    case "tolgee":
      return {
        action: "degrade",
        reason:
          "provider capability may degrade without becoming domain authority",
      };
    case "elmah_io":
      return {
        action: "continue_without_provider",
        reason: "telemetry is non-authoritative",
      };
    case "sumsub":
    case "twilio":
      return {
        action: "human_review",
        reason:
          "manual review may continue only under explicit KLYX policy",
      };
    case "vercel":
    case "github":
      return {
        action: "stop_control_plane",
        reason:
          "control-plane mutation must stop when provider state is uncertain",
      };
    case "supabase":
    case "stripe":
    case "cloudflare_turnstile":
      return {
        action: "block",
        reason:
          "authoritative or security-sensitive capability fails closed",
      };
  }
}

export function createKlyxProviderControlPlanePolicy(
  provider: KlyxExternalProviderName,
  overrides: Partial<KlyxProviderControlPlanePolicy> = {}
): KlyxProviderControlPlanePolicy {
  return {
    enabled: true,
    quota: null,
    budget: null,
    rateLimit: null,
    timeoutMs: null,
    retry: DEFAULT_RETRY_POLICY,
    fallback: fallbackFor(provider),
    circuitBreaker: null,
    health: DEFAULT_HEALTH_POLICY,
    ...overrides,
  };
}

export function createKlyxProviderControlPlaneRegistry(
  overrides: Partial<
    Record<KlyxExternalProviderName, Partial<KlyxProviderControlPlanePolicy>>
  > = {}
): KlyxProviderControlPlaneRegistration[] {
  return (Object.keys(KLYX_PROVIDER_CATALOG) as KlyxExternalProviderName[]).map(
    (provider) => {
      const catalog = KLYX_PROVIDER_CATALOG[provider];
      return {
        provider,
        capabilities: catalog.capabilities,
        authorityBoundary: catalog.authorityBoundary,
        policy: createKlyxProviderControlPlanePolicy(
          provider,
          overrides[provider]
        ),
      };
    }
  );
}

import "server-only";

import {
  KLYX_EXTERNAL_PROVIDER_NAMES,
  type KlyxExternalProviderName,
  type KlyxProviderAdapter,
  type KlyxProviderConfigurationState,
  type KlyxProviderStatus,
} from "./contracts";
import {
  getKlyxProviderPolicy,
} from "./catalog";

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function configurationState(
  name: KlyxExternalProviderName
): KlyxProviderConfigurationState {
  switch (name) {
    case "openai":
      return hasEnv("OPENAI_API_KEY")
        ? "configured"
        : "missing";
    case "supabase":
      return hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
        (hasEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
          hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
        ? "configured"
        : "missing";
    case "stripe":
      return hasEnv("STRIPE_SECRET_KEY") &&
        hasEnv("STRIPE_WEBHOOK_SECRET")
        ? "configured"
        : "missing";
    case "sumsub":
      return hasEnv("SUMSUB_APP_TOKEN") &&
        hasEnv("SUMSUB_SECRET_KEY") &&
        hasEnv("SUMSUB_LEVEL_NAME") &&
        hasEnv("SUMSUB_WEBHOOK_SECRET")
        ? "configured"
        : "missing";
    case "twilio": {
      const apiKeyAuth =
        hasEnv("TWILIO_API_KEY_SID") &&
        hasEnv("TWILIO_API_KEY_SECRET");
      const accountAuth =
        hasEnv("TWILIO_ACCOUNT_SID") &&
        hasEnv("TWILIO_AUTH_TOKEN");

      return hasEnv("TWILIO_VERIFY_SERVICE_SID") &&
        (apiKeyAuth || accountAuth)
        ? "configured"
        : "missing";
    }
    case "resend":
      return hasEnv("RESEND_API_KEY")
        ? "configured"
        : "missing";
    case "tolgee":
      return "static_snapshot";
    case "cloudflare_turnstile":
      return hasEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY")
        ? "configured"
        : "missing";
    case "elmah_io":
      return hasEnv("ELMAH_IO_API_KEY")
        ? "configured"
        : "missing";
    case "vercel":
    case "github":
      return "external_control_plane";
  }
}

class KlyxGovernedProviderAdapter
  implements KlyxProviderAdapter
{
  readonly policy;

  constructor(name: KlyxExternalProviderName) {
    this.policy = getKlyxProviderPolicy(name);
  }

  getStatus(): KlyxProviderStatus {
    return {
      name: this.policy.name,
      configuration: configurationState(this.policy.name),
      clientPolicy: this.policy.clientPolicy,
      failurePolicy: this.policy.failurePolicy,
      authorityBoundary: this.policy.authorityBoundary,
    };
  }
}

const adapters = Object.fromEntries(
  KLYX_EXTERNAL_PROVIDER_NAMES.map((name) => [
    name,
    new KlyxGovernedProviderAdapter(name),
  ])
) as Record<KlyxExternalProviderName, KlyxProviderAdapter>;

export function getKlyxProviderAdapter(
  name: KlyxExternalProviderName
): KlyxProviderAdapter {
  return adapters[name];
}

export function getKlyxProviderStatuses(): KlyxProviderStatus[] {
  return KLYX_EXTERNAL_PROVIDER_NAMES.map((name) =>
    adapters[name].getStatus()
  );
}

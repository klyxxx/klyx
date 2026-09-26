export const KLYX_EXTERNAL_PROVIDER_NAMES = [
  "openai",
  "supabase",
  "stripe",
  "sumsub",
  "twilio",
  "resend",
  "tolgee",
  "cloudflare_turnstile",
  "elmah_io",
  "vercel",
  "github",
] as const;

export type KlyxExternalProviderName =
  (typeof KLYX_EXTERNAL_PROVIDER_NAMES)[number];

export type KlyxProviderRuntimeRole =
  | "runtime"
  | "build_time"
  | "control_plane";

export type KlyxProviderClientPolicy =
  | "server_only"
  | "public_token_only"
  | "public_session_only"
  | "static_snapshot_only"
  | "control_plane_only";

export type KlyxProviderFailurePolicy =
  | "fail_closed"
  | "degrade"
  | "fail_open"
  | "stop_control_plane";

export type KlyxProviderCriticality =
  | "critical"
  | "important"
  | "optional"
  | "control_plane";

export type KlyxProviderAbstractionState =
  | "native_adapter"
  | "governed_boundary"
  | "static_snapshot"
  | "control_plane";

export type KlyxProviderPolicy = {
  name: KlyxExternalProviderName;
  capabilities: readonly string[];
  runtimeRole: KlyxProviderRuntimeRole;
  clientPolicy: KlyxProviderClientPolicy;
  failurePolicy: KlyxProviderFailurePolicy;
  criticality: KlyxProviderCriticality;
  abstractionState: KlyxProviderAbstractionState;
  secretEnv: readonly string[];
  publicEnv: readonly string[];
  indispensableFor: readonly string[];
  freeFallback: string | null;
  authorityBoundary: string;
};

export type KlyxProviderConfigurationState =
  | "configured"
  | "missing"
  | "static_snapshot"
  | "external_control_plane";

export type KlyxProviderStatus = {
  name: KlyxExternalProviderName;
  configuration: KlyxProviderConfigurationState;
  clientPolicy: KlyxProviderClientPolicy;
  failurePolicy: KlyxProviderFailurePolicy;
  authorityBoundary: string;
};

export interface KlyxProviderAdapter {
  readonly policy: KlyxProviderPolicy;
  getStatus(): KlyxProviderStatus;
}

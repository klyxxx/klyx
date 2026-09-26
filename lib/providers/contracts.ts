export const KLYX_PROVIDER_IDS = [
  "openai",
  "supabase",
  "stripe",
  "sumsub",
  "twilio",
  "resend",
  "tolgee",
  "turnstile",
  "elmah",
  "vercel",
  "github",
] as const;

export type KlyxProviderId = (typeof KLYX_PROVIDER_IDS)[number];

export type KlyxProviderCategory =
  | "replaceable-runtime"
  | "infrastructure"
  | "control-plane"
  | "client-assisted";

export type KlyxProviderCriticality =
  | "critical"
  | "important"
  | "optional";

export type KlyxProviderClientExposure =
  | "none"
  | "publishable-rls-bounded"
  | "public-widget"
  | "public-sdk-tokenized";

export type KlyxProviderFailureMode =
  | "fail-closed"
  | "fail-open"
  | "degraded-local"
  | "offline-snapshot"
  | "defer-and-retry";

export type KlyxProviderReplacementMode =
  | "runtime-adapter"
  | "planned-infrastructure-migration"
  | "control-plane-portable";

export type KlyxProviderDescriptor = {
  id: KlyxProviderId;
  capabilities: readonly string[];
  category: KlyxProviderCategory;
  criticality: KlyxProviderCriticality;
  serverAuthorityRequired: boolean;
  clientExposure: KlyxProviderClientExposure;
  failureMode: KlyxProviderFailureMode;
  replacementMode: KlyxProviderReplacementMode;
  fallback: string;
  productionPolicy: string;
  secretEnvironmentVariables: readonly string[];
  publicEnvironmentVariables: readonly string[];
};

export type KlyxProviderStatus = {
  id: KlyxProviderId;
  configured: boolean;
  productionReady: boolean;
  detail: string;
};

export interface KlyxProviderAdapter {
  readonly descriptor: KlyxProviderDescriptor;
  getStatus(): KlyxProviderStatus;
}

export type KlyxPhoneVerificationResult = {
  approved: boolean;
  status: string;
};

export interface KlyxPhoneVerificationProvider
  extends KlyxProviderAdapter {
  sendCode(phoneNumber: string): Promise<void>;
  verifyCode(
    phoneNumber: string,
    code: string
  ): Promise<KlyxPhoneVerificationResult>;
}

export type KlyxIdentitySessionTokenInput = {
  subjectId: string;
  email?: string | null;
};

export type KlyxIdentitySessionToken = {
  token: string;
  externalUserId?: string;
};

export interface KlyxIdentityVerificationProvider
  extends KlyxProviderAdapter {
  createSessionToken(
    input: KlyxIdentitySessionTokenInput
  ): Promise<KlyxIdentitySessionToken>;
}

export type KlyxEmailDeliveryInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

export type KlyxProfileEmailDeliveryInput = Omit<
  KlyxEmailDeliveryInput,
  "to"
> & {
  profileId: string;
};

export type KlyxEmailDeliveryResult = {
  ok: boolean;
  status: "sent" | "skipped" | "failed";
  provider: KlyxProviderId;
  httpStatus?: number;
};

export interface KlyxEmailDeliveryProvider
  extends KlyxProviderAdapter {
  sendTransactional(
    input: KlyxEmailDeliveryInput
  ): Promise<KlyxEmailDeliveryResult>;
  sendProfileTransactional(
    input: KlyxProfileEmailDeliveryInput
  ): Promise<KlyxEmailDeliveryResult>;
}

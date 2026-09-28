import "server-only";

import type { KlyxLlmProvider } from "@/lib/brain/llm/contracts";
import { claimExternalProviderCost } from "@/lib/providers/cost-control";

type IdentityTokenInput = {
  userId: string;
  email?: string | null;
};

type IdentityWebhookInput = {
  rawBody: string;
  digest: string | null;
  algorithm: string | null;
};

export type KlyxIdentityVerificationAdapter = {
  readonly provider: string;
  configured(): boolean;
  createSdkToken(
    input: IdentityTokenInput
  ): Promise<{ token: string; userId?: string }>;
  verifyWebhook(input: IdentityWebhookInput): boolean;
  hashWebhookPayload(rawBody: string): string;
};

export type KlyxPhoneVerificationAdapter = {
  readonly provider: string;
  sendOtp(phoneNumber: string): Promise<unknown>;
  verifyOtp(
    phoneNumber: string,
    code: string
  ): Promise<{ approved: boolean; status: string }>;
};

export type KlyxEmailDeliveryInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

export type KlyxProfileEmailDeliveryInput = {
  profileId: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

export type KlyxEmailDeliveryResult = {
  ok: boolean;
  status: "sent" | "skipped" | "failed";
  provider: string;
  httpStatus?: number;
};

export type KlyxEmailDeliveryAdapter = {
  readonly provider: string;
  sendTransactional(
    input: KlyxEmailDeliveryInput
  ): Promise<KlyxEmailDeliveryResult>;
  sendProfileTransactional(
    input: KlyxProfileEmailDeliveryInput
  ): Promise<KlyxEmailDeliveryResult>;
};

export type KlyxApiErrorReport = {
  event: string;
  route: string;
  method: string;
  status: number;
  code: string;
  durationMs?: number;
  requestId?: string;
  error?: unknown;
};

export type KlyxUnhandledRequestErrorReport = {
  error: unknown;
  method?: string;
  routePath?: string;
  routerKind?: string;
  routeType?: string;
  renderSource?: string;
};

export type KlyxObservabilityAdapter = {
  readonly provider: string;
  configured(): boolean;
  heartbeatConfigured(): boolean;
  reportApiError(input: KlyxApiErrorReport): Promise<boolean>;
  reportUnhandledRequestError(
    input: KlyxUnhandledRequestErrorReport
  ): Promise<boolean>;
  sendHeartbeat(): Promise<boolean>;
};

export async function getKlyxLlmAdapter(): Promise<KlyxLlmProvider> {
  const { getKlyxLlmProvider } = await import(
    "@/lib/brain/llm/provider"
  );

  return getKlyxLlmProvider();
}

export async function getKlyxIdentityVerificationAdapter(): Promise<KlyxIdentityVerificationAdapter> {
  const provider = await import("@/lib/sumsub");

  return {
    provider: "sumsub",
    configured: provider.sumsubConfigured,
    createSdkToken: async (input) => {
      await claimExternalProviderCost(
        "sumsub",
        "identity_sdk_token",
      );
      return provider.createSumsubSdkToken(input);
    },
    verifyWebhook: provider.verifySumsubWebhook,
    hashWebhookPayload: provider.hashWebhookPayload,
  };
}

export async function getKlyxPhoneVerificationAdapter(): Promise<KlyxPhoneVerificationAdapter> {
  const provider = await import("@/lib/twilio-verify");

  return {
    provider: "twilio",
    sendOtp: async (phoneNumber) => {
      await claimExternalProviderCost(
        "twilio",
        "phone_otp_send",
      );
      return provider.sendPhoneOtp(phoneNumber);
    },
    verifyOtp: async (phoneNumber, code) => {
      await claimExternalProviderCost(
        "twilio",
        "phone_otp_verify",
      );
      return provider.verifyPhoneOtp(phoneNumber, code);
    },
  };
}

export async function getKlyxEmailDeliveryAdapter(): Promise<KlyxEmailDeliveryAdapter> {
  const provider = await import("@/lib/email/resend");

  return {
    provider: "resend",
    sendTransactional: async (input) => {
      await claimExternalProviderCost(
        "resend",
        "transactional_email",
        input.idempotencyKey,
      );
      return provider.sendKlyxTransactionalEmail(input);
    },
    sendProfileTransactional: async (input) => {
      await claimExternalProviderCost(
        "resend",
        "profile_transactional_email",
        input.idempotencyKey,
      );
      return provider.sendKlyxProfileTransactionalEmail(input);
    },
  };
}

export async function getKlyxObservabilityAdapter(): Promise<KlyxObservabilityAdapter> {
  const provider = await import("@/lib/elmah-io");

  return {
    provider: "elmah_io",
    configured: provider.isKlyxElmahIoConfigured,
    heartbeatConfigured:
      provider.isKlyxElmahHeartbeatConfigured,
    reportApiError: provider.reportKlyxApiError,
    reportUnhandledRequestError:
      provider.reportKlyxUnhandledRequestError,
    sendHeartbeat: provider.sendKlyxElmahHeartbeat,
  };
}

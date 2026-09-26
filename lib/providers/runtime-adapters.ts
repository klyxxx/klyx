import "server-only";

import type { KlyxLlmProvider } from "@/lib/brain/llm/contracts";

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
  readonly provider: "sumsub";
  configured(): boolean;
  createSdkToken(
    input: IdentityTokenInput
  ): Promise<{ token: string; userId?: string }>;
  verifyWebhook(input: IdentityWebhookInput): boolean;
  hashWebhookPayload(rawBody: string): string;
};

export type KlyxPhoneVerificationAdapter = {
  readonly provider: "twilio";
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

export type KlyxEmailDeliveryAdapter = {
  readonly provider: "resend";
  sendTransactional(input: KlyxEmailDeliveryInput): Promise<unknown>;
  sendProfileTransactional(
    input: KlyxProfileEmailDeliveryInput
  ): Promise<unknown>;
};

export type KlyxObservabilityAdapter = {
  readonly provider: "elmah_io";
  configured(): boolean;
  heartbeatConfigured(): boolean;
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
    createSdkToken: provider.createSumsubSdkToken,
    verifyWebhook: provider.verifySumsubWebhook,
    hashWebhookPayload: provider.hashWebhookPayload,
  };
}

export async function getKlyxPhoneVerificationAdapter(): Promise<KlyxPhoneVerificationAdapter> {
  const provider = await import("@/lib/twilio-verify");

  return {
    provider: "twilio",
    sendOtp: provider.sendPhoneOtp,
    verifyOtp: provider.verifyPhoneOtp,
  };
}

export async function getKlyxEmailDeliveryAdapter(): Promise<KlyxEmailDeliveryAdapter> {
  const provider = await import("@/lib/email/resend");

  return {
    provider: "resend",
    sendTransactional: provider.sendKlyxTransactionalEmail,
    sendProfileTransactional:
      provider.sendKlyxProfileTransactionalEmail,
  };
}

export async function getKlyxObservabilityAdapter(): Promise<KlyxObservabilityAdapter> {
  const provider = await import("@/lib/elmah-io");

  return {
    provider: "elmah_io",
    configured: provider.isKlyxElmahIoConfigured,
    heartbeatConfigured:
      provider.isKlyxElmahHeartbeatConfigured,
    sendHeartbeat: provider.sendKlyxElmahHeartbeat,
  };
}

import "server-only";

import type {
  KlyxEmailDeliveryProvider,
  KlyxIdentityVerificationProvider,
  KlyxPhoneVerificationProvider,
  KlyxProviderAdapter,
  KlyxProviderId,
  KlyxProviderStatus,
} from "./contracts";
import {
  KLYX_PROVIDER_ADAPTERS,
  openAiProviderAdapter,
  resendProviderAdapter,
  sumsubProviderAdapter,
  twilioProviderAdapter,
} from "./adapters.server";

export function getKlyxProviderAdapter(
  id: KlyxProviderId
): KlyxProviderAdapter {
  return KLYX_PROVIDER_ADAPTERS[id];
}

export function getKlyxProviderStatuses(): KlyxProviderStatus[] {
  return Object.values(KLYX_PROVIDER_ADAPTERS).map((adapter) =>
    adapter.getStatus()
  );
}

export function getKlyxLlmProvider() {
  return openAiProviderAdapter.getProvider();
}

export function getKlyxPhoneVerificationProvider(): KlyxPhoneVerificationProvider {
  return twilioProviderAdapter;
}

export function getKlyxIdentityVerificationProvider(): KlyxIdentityVerificationProvider {
  return sumsubProviderAdapter;
}

export function getKlyxEmailDeliveryProvider(): KlyxEmailDeliveryProvider {
  return resendProviderAdapter;
}

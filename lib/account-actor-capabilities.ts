export const CORE_ACCOUNT_CAPABILITIES = [
  "request_services",
  "offer_services",
] as const;

export type CoreAccountCapability =
  (typeof CORE_ACCOUNT_CAPABILITIES)[number];

export type AccountCapabilityKey = string;

export type AccountCapabilitySource =
  | "account"
  | "legacy_fallback";

export type AccountCapabilityRow = {
  account_id: string;
  capability: string;
  enabled: boolean;
};

export type AccountCapabilityState = {
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: AccountCapabilitySource;
  enabledCapabilities: ReadonlySet<string>;
};

export type LegacyCapabilityProfile = {
  accountType: "client" | "provider";
};

export function legacyFallbackAccountCapabilityState(
  profiles: readonly LegacyCapabilityProfile[]
): AccountCapabilityState {
  const canOfferServices = profiles.some(
    (profile) => profile.accountType === "provider"
  );

  return {
    // Canonical KLYX accounts are request-capable by default. This matches the
    // additive database backfill and lets old provider-only accounts obtain a
    // service without becoming a different identity.
    canRequestServices: true,
    canOfferServices,
    capabilitySource: "legacy_fallback",
    enabledCapabilities: new Set([
      "request_services",
      ...(canOfferServices ? ["offer_services"] : []),
    ]),
  };
}

export function resolveAccountCapabilityState(
  rows: readonly AccountCapabilityRow[]
): AccountCapabilityState {
  const enabledCapabilities = new Set(
    rows
      .filter((row) => row.enabled)
      .map((row) => row.capability)
  );

  return {
    canRequestServices: enabledCapabilities.has("request_services"),
    canOfferServices: enabledCapabilities.has("offer_services"),
    capabilitySource: "account",
    enabledCapabilities,
  };
}

export function hasAccountCapability(
  state: AccountCapabilityState,
  capability: AccountCapabilityKey
): boolean {
  return state.enabledCapabilities.has(capability);
}

export type LegacyAccountType = "client" | "provider";

export type ProfileActorCapability =
  | "request_services"
  | "offer_services";

export type ProfileCapabilitySource = "capabilities" | "legacy";

export type ProfileCapabilityState = {
  canRequestServices: boolean;
  canOfferServices: boolean;
  capabilitySource: ProfileCapabilitySource;
};

export type ProfileActorCapabilityRow = {
  profile_id: string;
  capability: string;
  enabled: boolean;
};

export const PROFILE_ACTOR_CAPABILITIES = [
  "request_services",
  "offer_services",
] as const satisfies readonly ProfileActorCapability[];

export function normalizeLegacyAccountType(
  value: string | null | undefined
): LegacyAccountType {
  return value === "provider" ? "provider" : "client";
}

export function legacyCapabilityState(
  accountType: LegacyAccountType
): ProfileCapabilityState {
  return {
    canRequestServices: accountType === "client",
    canOfferServices: accountType === "provider",
    capabilitySource: "legacy",
  };
}

export function resolveProfileCapabilityState(
  accountType: LegacyAccountType,
  rows: readonly ProfileActorCapabilityRow[]
): ProfileCapabilityState {
  if (rows.length === 0) {
    return legacyCapabilityState(accountType);
  }

  const enabledByCapability = new Map(
    rows.map((row) => [row.capability, row.enabled] as const)
  );

  return {
    canRequestServices:
      enabledByCapability.get("request_services") === true,
    canOfferServices:
      enabledByCapability.get("offer_services") === true,
    capabilitySource: "capabilities",
  };
}

export function legacyAccountTypeForCapabilities(
  state: Pick<
    ProfileCapabilityState,
    "canRequestServices" | "canOfferServices"
  >
): LegacyAccountType {
  // Compatibility only: dual-capability profiles keep the client discriminator
  // while migrated authorization reads the two independent capabilities.
  return state.canOfferServices && !state.canRequestServices
    ? "provider"
    : "client";
}

export type KlyxAccountType = "client" | "provider";

export type KlyxAccountHomeCapabilities = {
  canRequestServices: boolean;
  canOfferServices: boolean;
};

export const KLYX_ACCOUNT_HOME = {
  client: "/assistant",
  provider: "/assistant",
} as const satisfies Record<KlyxAccountType, string>;

export function getKlyxAccountHome(accountType: KlyxAccountType): string;
export function getKlyxAccountHome(
  capabilities: KlyxAccountHomeCapabilities
): string;
export function getKlyxAccountHome(
  input: KlyxAccountType | KlyxAccountHomeCapabilities
) {
  if (typeof input === "string") {
    return KLYX_ACCOUNT_HOME[input];
  }

  if (input.canRequestServices || input.canOfferServices) {
    return "/assistant";
  }

  return "/profile";
}

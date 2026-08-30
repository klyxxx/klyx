export type KlyxAccountType = "client" | "provider";

export const KLYX_ACCOUNT_HOME = {
  client: "/assistant",
  provider: "/provider/assistant",
} as const satisfies Record<KlyxAccountType, string>;

export function getKlyxAccountHome(accountType: KlyxAccountType) {
  return KLYX_ACCOUNT_HOME[accountType];
}

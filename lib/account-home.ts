export type KlyxAccountType = "client" | "provider";

export const KLYX_ACCOUNT_HOME = {
  client: "/assistant",
  provider: "/assistant",
} as const satisfies Record<KlyxAccountType, string>;

export function getKlyxAccountHome(_accountType: KlyxAccountType) {
  return "/assistant" as const;
}

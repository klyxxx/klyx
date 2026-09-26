function required(name: string, value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`Missing public mobile configuration: ${name}`);
  return normalized.replace(/\/$/, "");
}

export const mobileConfig = {
  apiUrl: required("EXPO_PUBLIC_KLYX_API_URL", process.env.EXPO_PUBLIC_KLYX_API_URL),
  supabaseUrl: required(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL
  ),
  supabasePublishableKey: required(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
} as const;

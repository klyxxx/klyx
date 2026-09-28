function requiredPublicEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`KLYX mobile configuration missing: ${name}`);
  }

  return value;
}

export const KLYX_API_BASE_URL = requiredPublicEnv(
  "EXPO_PUBLIC_KLYX_API_BASE_URL"
).replace(/\/+$/, "");

export const KLYX_SUPABASE_URL = requiredPublicEnv(
  "EXPO_PUBLIC_SUPABASE_URL"
);

export const KLYX_SUPABASE_PUBLISHABLE_KEY = requiredPublicEnv(
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
);

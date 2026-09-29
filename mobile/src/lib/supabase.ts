import "react-native-url-polyfill/auto";

import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { secureSessionStorage } from "./secure-storage";

function requiredPublicEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`KLYX mobile configuration missing: ${name}`);
  }

  return value;
}

export const supabase = createClient(
  requiredPublicEnv("EXPO_PUBLIC_SUPABASE_URL"),
  requiredPublicEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

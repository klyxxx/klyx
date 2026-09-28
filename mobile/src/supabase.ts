import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import {
  KLYX_SUPABASE_PUBLISHABLE_KEY,
  KLYX_SUPABASE_URL,
} from "./config";
import { secureStorage } from "./secure-storage";

export const supabase = createClient(
  KLYX_SUPABASE_URL,
  KLYX_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

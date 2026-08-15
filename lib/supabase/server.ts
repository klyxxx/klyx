import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore =
    await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL manquante."
    );
  }

  if (!supabaseKey) {
    throw new Error(
      "Cle publique Supabase manquante."
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // Server Components cannot always modify cookies.
          }
        },
      },
    }
  );
}

// KLYX_SUPABASE_PUBLIC_KEY_COMPAT_PHASE_7B_2

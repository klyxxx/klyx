import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

/**
 * KLYX_SUPABASE_ADMIN_LAZY_PHASE_10A_1
 *
 * Important:
 * - aucune Service Role Key n'est requise au moment de l'import ;
 * - le build Next.js peut donc analyser les routes sans secret admin ;
 * - la clé reste obligatoire dès qu'une opération admin est réellement utilisée.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant."
    );
  }

  cachedAdminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return cachedAdminClient;
}

/**
 * Compatibilité avec toutes les routes existantes utilisant :
 *
 *   supabaseAdmin.from(...)
 *   supabaseAdmin.rpc(...)
 *   supabaseAdmin.auth...
 *   supabaseAdmin.storage...
 *
 * Le vrai client n'est créé qu'au premier accès runtime.
 */
export const supabaseAdmin =
  new Proxy({} as SupabaseClient, {
    get(_target, property) {
      const client =
        getSupabaseAdmin();

      const value =
        Reflect.get(
          client,
          property,
          client
        );

      if (typeof value === "function") {
        return value.bind(client);
      }

      return value;
    },
  });
import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  findGoldenPathUserByEmail,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

async function main() {
  const { e2eOrigin } = assertGoldenPathIsolation();
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const supabase = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const user = await findGoldenPathUserByEmail(supabase, email);

  if (!user) {
    throw new Error(
      "Dedicated golden-path auth user is missing from the isolated Supabase project."
    );
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, account_type, country_code, currency_code, city")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Unable to inspect golden-path profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error(
      "Dedicated golden-path account must own both a client and a provider profile."
    );
  }

  for (const [label, profile] of [
    ["client", client],
    ["provider", provider],
  ]) {
    if (profile.country_code !== "BE") {
      throw new Error(`${label} golden-path profile must use country_code=BE.`);
    }

    if (profile.currency_code !== "EUR") {
      throw new Error(`${label} golden-path profile must use currency_code=EUR.`);
    }
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(
      `Unable to inspect the golden-path service catalog: ${servicesError.message}`
    );
  }

  const service = (services ?? []).find(
    (candidate) =>
      candidate.slug === "cleaning" ||
      candidate.slug === "menage" ||
      candidate.slug === "ménage"
  );

  if (!service) {
    throw new Error(
      "Golden-path Supabase needs a canonical cleaning/menage service in the services catalog."
    );
  }

  // IDs are non-secret fixture handles. Never print the dedicated email/password/keys.
  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      clientProfileId: client.id,
      providerProfileId: provider.id,
      serviceId: service.id,
      serviceSlug: service.slug,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path preflight failed: ${message}`);
  process.exitCode = 1;
});

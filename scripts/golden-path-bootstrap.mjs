import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  findGoldenPathUserByEmail,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const PROFILE_SELECT =
  "id, owner_user_id, account_type, country_code, currency_code, city";
const CLEANING_SERVICE_SLUGS = new Set([
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
]);

async function createOwnedProfile({
  userClient,
  admin,
  userId,
  accountType,
  serviceId,
}) {
  const { data: profileId, error } = await userClient.rpc(
    "klyx_create_profile",
    {
      p_first_name: accountType === "client" ? "Golden" : "Provider",
      p_last_name: "Path",
      p_city: "Bruxelles",
      p_account_type: accountType,
      p_service_id: accountType === "provider" ? serviceId : null,
    }
  );

  if (error) {
    throw new Error(
      `Unable to create the golden-path ${accountType} profile: ${error.message}`
    );
  }

  if (typeof profileId !== "string" || !profileId) {
    throw new Error(
      `Golden-path ${accountType} profile creation returned an invalid id.`
    );
  }

  const { data: profile, error: updateError } = await admin
    .from("profiles")
    .update({
      country_code: "BE",
      currency_code: "EUR",
      city: "Bruxelles",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .eq("owner_user_id", userId)
    .select(PROFILE_SELECT)
    .single();

  if (updateError) {
    throw new Error(
      `Unable to normalize the golden-path ${accountType} profile: ${updateError.message}`
    );
  }

  return profile;
}

async function main() {
  const { e2eOrigin } = assertGoldenPathIsolation();
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let user = await findGoldenPathUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "KLYX Golden Path",
        account_type: "client",
      },
    });

    if (error || !data.user) {
      throw new Error(
        `Unable to create the dedicated golden-path auth user: ${
          error?.message ?? "unknown error"
        }`
      );
    }

    user = data.user;
  }

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(
      "Dedicated golden-path auth user exists but the configured password does not match."
    );
  }

  const { data: services, error: servicesError } = await admin
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(
      `Unable to load the golden-path service catalog: ${servicesError.message}`
    );
  }

  const service = (services ?? []).find((candidate) =>
    CLEANING_SERVICE_SLUGS.has(candidate.slug)
  );

  if (!service) {
    throw new Error(
      "Golden-path Supabase needs a canonical cleaning/menage service before account bootstrap."
    );
  }

  const { data: existingProfiles, error: profilesError } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Unable to inspect golden-path profiles: ${profilesError.message}`
    );
  }

  let client = (existingProfiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  let provider = (existingProfiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client) {
    client = await createOwnedProfile({
      userClient,
      admin,
      userId: user.id,
      accountType: "client",
      serviceId: service.id,
    });
  }

  if (!provider) {
    provider = await createOwnedProfile({
      userClient,
      admin,
      userId: user.id,
      accountType: "provider",
      serviceId: service.id,
    });
  }

  for (const profile of [client, provider]) {
    const { error } = await admin
      .from("profiles")
      .update({
        country_code: "BE",
        currency_code: "EUR",
        city: "Bruxelles",
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .eq("owner_user_id", user.id);

    if (error) {
      throw new Error(
        `Unable to normalize golden-path profile ${profile.id}: ${error.message}`
      );
    }
  }

  await userClient.auth.signOut();

  // Never print the dedicated email/password/keys.
  process.stdout.write(
    `${JSON.stringify({
      bootstrapped: true,
      clientProfileId: client.id,
      providerProfileId: provider.id,
      serviceId: service.id,
      serviceSlug: service.slug,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path bootstrap failed: ${message}`);
  process.exitCode = 1;
});

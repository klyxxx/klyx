import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  findGoldenPathUserByEmail,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const CLEANING_SERVICE_SLUGS = [
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
];

function cleaningService(services) {
  for (const slug of CLEANING_SERVICE_SLUGS) {
    const service = services.find((candidate) => candidate.slug === slug);
    if (service) {
      return service;
    }
  }

  return undefined;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path provider fixtures are allowed only on ephemeral local Supabase."
    );
  }

  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const user = await findGoldenPathUserByEmail(admin, email);

  if (!user) {
    throw new Error(
      "Golden-path auth user must be bootstrapped before provider fixtures."
    );
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type, country_code, currency_code")
    .eq("owner_user_id", user.id);

  if (profilesError) {
    throw new Error(`Unable to load golden-path profiles: ${profilesError.message}`);
  }

  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );
  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );

  if (!provider || !client) {
    throw new Error(
      "Golden-path client and provider profiles must exist before provider fixtures."
    );
  }

  for (const profile of [provider, client]) {
    if (profile.country_code !== "BE" || profile.currency_code !== "EUR") {
      throw new Error("Golden-path profiles must use the BE/EUR market.");
    }
  }

  const { data: services, error: servicesError } = await admin
    .from("services")
    .select("id, slug, name")
    .order("name", { ascending: true })
    .limit(500);

  if (servicesError) {
    throw new Error(`Unable to load service catalog: ${servicesError.message}`);
  }

  const service = cleaningService(services ?? []);

  if (!service) {
    throw new Error("Canonical cleaning/menage service is missing.");
  }

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, service_id, active, provider_enabled")
    .eq("user_id", provider.id)
    .eq("service_id", service.id)
    .maybeSingle();

  if (userServiceError) {
    throw new Error(`Unable to load provider user service: ${userServiceError.message}`);
  }

  if (!userService) {
    throw new Error(
      "Provider bootstrap did not create the selected KLYX user_service."
    );
  }

  const now = new Date().toISOString();

  const { error: userServiceUpdateError } = await admin
    .from("user_services")
    .update({
      active: true,
      provider_enabled: true,
      updated_at: now,
    })
    .eq("id", userService.id)
    .eq("user_id", provider.id);

  if (userServiceUpdateError) {
    throw new Error(
      `Unable to activate provider service: ${userServiceUpdateError.message}`
    );
  }

  const { error: providerProfileError } = await admin
    .from("provider_profiles")
    .upsert(
      {
        profile_id: provider.id,
        business_name: "KLYX Golden Cleaning",
        headline: "Ménage fiable pour le golden path KLYX",
        bio:
          "Prestataire éphémère utilisé uniquement pour valider le parcours KLYX de bout en bout dans une base locale isolée.",
        years_experience: 5,
        is_published: true,
        verification_status: "verified",
        updated_at: now,
      },
      { onConflict: "profile_id" }
    );

  if (providerProfileError) {
    throw new Error(
      `Unable to publish provider fixture: ${providerProfileError.message}`
    );
  }

  const { data: existingServiceProfile, error: serviceProfileLookupError } =
    await admin
      .from("service_profiles")
      .select("id")
      .eq("user_service_id", userService.id)
      .maybeSingle();

  if (serviceProfileLookupError) {
    throw new Error(
      `Unable to inspect service profile: ${serviceProfileLookupError.message}`
    );
  }

  const serviceProfilePayload = {
    title: "Ménage Golden Path KLYX",
    description:
      "Service de ménage éphémère configuré pour vérifier recherche, devis, réservation, paiement et avis KLYX.",
    pricing_type: "hourly",
    price: 35,
    hourly_price: 35,
    fixed_price: null,
    city: "Bruxelles",
    service_area: ["Bruxelles"],
    travel_radius_km: 30,
    available: true,
    klyx_score: 90,
    completed_jobs: 0,
    cancellation_rate: 0,
    rating: 0,
    review_count: 0,
    updated_at: now,
  };

  if (existingServiceProfile) {
    const { error } = await admin
      .from("service_profiles")
      .update(serviceProfilePayload)
      .eq("id", existingServiceProfile.id)
      .eq("user_service_id", userService.id);

    if (error) {
      throw new Error(`Unable to update service profile fixture: ${error.message}`);
    }
  } else {
    const { error } = await admin.from("service_profiles").insert({
      user_service_id: userService.id,
      ...serviceProfilePayload,
    });

    if (error) {
      throw new Error(`Unable to create service profile fixture: ${error.message}`);
    }
  }

  const { error: availabilityDeleteError } = await admin
    .from("availability_slots")
    .delete()
    .eq("user_service_id", userService.id);

  if (availabilityDeleteError) {
    throw new Error(
      `Unable to reset fixture availability: ${availabilityDeleteError.message}`
    );
  }

  const { error: availabilityInsertError } = await admin
    .from("availability_slots")
    .insert(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        user_service_id: userService.id,
        day_of_week: dayOfWeek,
        start_time: "08:00",
        end_time: "20:00",
        is_active: true,
        updated_at: now,
      }))
    );

  if (availabilityInsertError) {
    throw new Error(
      `Unable to create fixture availability: ${availabilityInsertError.message}`
    );
  }

  const { data: existingZone, error: zoneLookupError } = await admin
    .from("provider_service_zones")
    .select("id")
    .eq("profile_id", provider.id)
    .eq("user_service_id", userService.id)
    .eq("country_code", "BE")
    .eq("locality", "Bruxelles")
    .maybeSingle();

  if (zoneLookupError) {
    throw new Error(`Unable to inspect provider zone: ${zoneLookupError.message}`);
  }

  const zonePayload = {
    profile_id: provider.id,
    user_service_id: userService.id,
    country_code: "BE",
    locality: "Bruxelles",
    postal_code: "1000",
    radius_km: 30,
    is_primary: true,
    is_active: true,
    updated_at: now,
  };

  if (existingZone) {
    const { error } = await admin
      .from("provider_service_zones")
      .update(zonePayload)
      .eq("id", existingZone.id)
      .eq("profile_id", provider.id);

    if (error) {
      throw new Error(`Unable to update provider zone: ${error.message}`);
    }
  } else {
    const { error } = await admin
      .from("provider_service_zones")
      .insert(zonePayload);

    if (error) {
      throw new Error(`Unable to create provider zone: ${error.message}`);
    }
  }

  const { error: skillError } = await admin
    .from("provider_skill_verifications")
    .upsert(
      {
        profile_id: provider.id,
        user_service_id: userService.id,
        status: "approved",
        provider_statement:
          "Golden-path fixture approved only inside the ephemeral local Supabase runner.",
        years_experience: 5,
        submitted_at: now,
        reviewed_at: now,
        review_note: "Ephemeral E2E fixture",
        updated_at: now,
      },
      { onConflict: "profile_id,user_service_id" }
    );

  if (skillError) {
    throw new Error(`Unable to approve provider fixture skill: ${skillError.message}`);
  }

  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      clientProfileId: client.id,
      providerProfileId: provider.id,
      serviceId: service.id,
      serviceSlug: service.slug,
      userServiceId: userService.id,
      hourlyPrice: 35,
      city: "Bruxelles",
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path provider fixture failed: ${message}`);
  process.exitCode = 1;
});

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method,
  body,
  expectedStatuses = [200],
}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (profileId) {
    headers.Cookie = `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`;
  }

  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`${method} ${path} returned non-JSON status ${response.status}.`);
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";
    throw new Error(`${method} ${path} returned ${response.status}: ${safeMessage}`);
  }

  return payload;
}

function addHours(time, hours) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + Math.round(hours * 60);
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;

  if (nextHour > 23) {
    throw new Error("Golden-path analyzed time extends beyond the same day.");
  }

  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path intent/search proof is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path intent/search proof requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the golden-path KLYX account.");
  }

  const accessToken = signInData.session.access_token;
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(`Unable to load golden-path profiles: ${profilesError.message}`);
  }

  const client = (profiles ?? []).find((profile) => profile.account_type === "client");
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Golden-path client/provider profiles are missing.");
  }

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .maybeSingle();

  if (userServiceError || !userService) {
    throw new Error(
      `Unable to resolve golden-path provider service: ${
        userServiceError?.message ?? "missing fixture"
      }`
    );
  }

  const relation = Array.isArray(userService.services)
    ? userService.services[0]
    : userService.services;
  const expectedServiceSlug = relation?.slug;

  if (typeof expectedServiceSlug !== "string" || !expectedServiceSlug) {
    throw new Error("Golden-path provider service slug is missing.");
  }

  const analysis = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/requests/analyze",
    method: "POST",
    body: {
      text: "J'ai besoin d'un ménage à Bruxelles demain à 10h pendant 2 heures avec un budget de 100 €.",
    },
  });

  const requestId = analysis?.requestId;
  const parsed = analysis?.parsed;

  if (typeof requestId !== "string" || !requestId) {
    throw new Error("KLYX request analysis did not create a service request.");
  }

  if (
    parsed?.readyForSearch !== true ||
    parsed?.serviceSlug !== expectedServiceSlug ||
    parsed?.city !== "Bruxelles" ||
    typeof parsed?.requestedDay !== "string" ||
    parsed?.requestedTime !== "10:00:00" ||
    Number(parsed?.durationHours) !== 2 ||
    Number(parsed?.budgetMax) !== 100 ||
    (parsed?.missingFields?.length ?? 1) !== 0
  ) {
    throw new Error(
      `KLYX request analysis is not search-ready: ${JSON.stringify(parsed)}`
    );
  }

  const { data: storedRequest, error: storedRequestError } = await admin
    .from("service_requests")
    .select(
      "id, user_id, detected_service_slug, city, requested_day, requested_time, budget_max, status"
    )
    .eq("id", requestId)
    .single();

  if (storedRequestError) {
    throw new Error(
      `Unable to verify persisted service request: ${storedRequestError.message}`
    );
  }

  if (
    storedRequest.user_id !== client.id ||
    storedRequest.detected_service_slug !== expectedServiceSlug ||
    storedRequest.city !== "Bruxelles" ||
    storedRequest.status !== "ready" ||
    Number(storedRequest.budget_max) !== 100
  ) {
    throw new Error("Persisted KLYX service request does not match the analyzed need.");
  }

  const start = parsed.requestedTime.slice(0, 5);
  const end = addHours(start, Number(parsed.durationHours));
  const params = new URLSearchParams({
    service: parsed.serviceSlug,
    city: parsed.city,
    date: parsed.requestedDay,
    start,
    end,
    budget: String(parsed.budgetMax),
    pricing: "hourly",
    sort: "recommended",
  });

  const search = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: `/api/search/providers?${params.toString()}`,
    method: "GET",
  });

  if (
    search?.exactCount !== 1 ||
    search?.showingAlternatives !== false ||
    !Array.isArray(search?.providers) ||
    search.providers.length !== 1
  ) {
    throw new Error(
      `Provider search did not return exactly one exact match: ${JSON.stringify(search)}`
    );
  }

  const matchedProvider = search.providers[0];
  if (
    matchedProvider.profileId !== provider.id ||
    matchedProvider.userServiceId !== userService.id ||
    matchedProvider.serviceSlug !== expectedServiceSlug ||
    matchedProvider.city !== "Bruxelles" ||
    matchedProvider.pricingType !== "hourly" ||
    Number(matchedProvider.price) !== 35 ||
    matchedProvider.isExactMatch !== true
  ) {
    throw new Error(
      "KLYX provider search did not return the expected exact golden-path provider."
    );
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      readyForQuote: true,
      requestId,
      serviceSlug: parsed.serviceSlug,
      city: parsed.city,
      requestedDay: parsed.requestedDay,
      requestedTime: parsed.requestedTime,
      providerProfileId: matchedProvider.profileId,
      userServiceId: matchedProvider.userServiceId,
      exactCount: search.exactCount,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path intent/search failed: ${message}`);
  process.exitCode = 1;
});

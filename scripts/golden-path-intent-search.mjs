import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";
const CLEANING_SERVICE_SLUGS = new Set([
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
]);

function futureBrusselsDate(daysAhead = 14) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const anchor = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + daysAhead,
      12,
      0,
      0
    )
  );

  return anchor.toISOString().slice(0, 10);
}

function frenchDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function serviceSlugFromRelation(relation) {
  const service = Array.isArray(relation) ? relation[0] : relation;
  return typeof service?.slug === "string" ? service.slug : "";
}

function isCleaningSlug(slug) {
  return CLEANING_SERVICE_SLUGS.has(slug);
}

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
    Authorization: `Bearer ${accessToken}`,
    Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
    "Content-Type": "application/json",
  };

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
      throw new Error(
        `${method} ${path} returned non-JSON status ${response.status}.`
      );
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";

    throw new Error(
      `${method} ${path} returned ${response.status}: ${safeMessage}`
    );
  }

  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path intent search is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path intent search requires the isolated local KLYX server on 127.0.0.1:3100."
    );
  }

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session?.access_token || !signInData.user) {
    throw new Error("Unable to authenticate the golden-path KLYX account.");
  }

  const accessToken = signInData.session.access_token;
  const admin = createClient(e2eOrigin, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(
      `Unable to load golden-path profiles: ${profilesError.message}`
    );
  }

  const client = (profiles ?? []).find(
    (profile) => profile.account_type === "client"
  );
  const provider = (profiles ?? []).find(
    (profile) => profile.account_type === "provider"
  );

  if (!client || !provider) {
    throw new Error("Golden-path client/provider profiles are missing.");
  }

  const { data: userServices, error: userServicesError } = await admin
    .from("user_services")
    .select("id, user_id, service_id, active, provider_enabled, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true);

  if (userServicesError) {
    throw new Error(
      `Unable to resolve provider services: ${userServicesError.message}`
    );
  }

  const expectedUserService = (userServices ?? []).find((item) =>
    isCleaningSlug(serviceSlugFromRelation(item.services))
  );

  if (!expectedUserService) {
    throw new Error("Golden-path cleaning provider fixture is missing.");
  }

  const expectedServiceSlug = serviceSlugFromRelation(
    expectedUserService.services
  );
  const requestedDate = futureBrusselsDate(14);
  const requestedTime = "10:00";
  const requestedEnd = "12:00";
  const intentText =
    `J'ai besoin d'un ménage à Bruxelles à 10h le ${frenchDate(requestedDate)}, budget 100 €.`;

  const initialAnalysis = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/requests/analyze",
    method: "POST",
    body: { text: intentText },
  });

  const initialRequestId = initialAnalysis?.requestId;
  const initialParsed = initialAnalysis?.parsed;

  if (
    typeof initialRequestId !== "string" ||
    !initialRequestId ||
    !initialParsed
  ) {
    throw new Error(
      "KLYX ambiguity analysis did not return a persisted request."
    );
  }

  const clarificationCandidates = Array.isArray(
    initialParsed.clarificationCandidates
  )
    ? initialParsed.clarificationCandidates
    : [];
  const expectedCandidate = clarificationCandidates.find(
    (candidate) => candidate?.slug === expectedServiceSlug
  );

  if (
    initialParsed.serviceAmbiguous !== true ||
    initialParsed.readyForSearch !== false ||
    initialParsed.serviceSlug !== null ||
    !expectedCandidate ||
    !Array.isArray(initialParsed.missingFields) ||
    !initialParsed.missingFields.includes("le type de service")
  ) {
    throw new Error(
      `KLYX did not preserve the explicit service-ambiguity boundary: ${JSON.stringify({
        serviceAmbiguous: initialParsed.serviceAmbiguous,
        readyForSearch: initialParsed.readyForSearch,
        serviceSlug: initialParsed.serviceSlug,
        clarificationCandidates: clarificationCandidates.map(
          (candidate) => candidate?.slug ?? null
        ),
        missingFields: initialParsed.missingFields,
      })}`
    );
  }

  const { data: ambiguousRequest, error: ambiguousRequestError } = await admin
    .from("service_requests")
    .select(
      "id, user_id, raw_text, detected_service_slug, city, requested_day, requested_time, budget_max, status, parsed_payload"
    )
    .eq("id", initialRequestId)
    .single();

  if (ambiguousRequestError) {
    throw new Error(
      `Unable to verify ambiguous service request: ${ambiguousRequestError.message}`
    );
  }

  if (
    ambiguousRequest.user_id !== client.id ||
    ambiguousRequest.raw_text !== intentText ||
    ambiguousRequest.detected_service_slug !== null ||
    ambiguousRequest.status !== "analyzed" ||
    ambiguousRequest.parsed_payload?.serviceAmbiguous !== true
  ) {
    throw new Error(
      "Ambiguous service request was not persisted fail-closed."
    );
  }

  const clarifiedAnalysis = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/requests/analyze",
    method: "POST",
    body: {
      text: intentText,
      selectedServiceSlug: expectedServiceSlug,
    },
  });

  const requestId = clarifiedAnalysis?.requestId;
  const parsed = clarifiedAnalysis?.parsed;

  if (typeof requestId !== "string" || !requestId || !parsed) {
    throw new Error(
      "KLYX clarified request analysis did not return a persisted request."
    );
  }

  if (
    parsed.readyForSearch !== true ||
    parsed.serviceAmbiguous !== false ||
    parsed.serviceSlug !== expectedServiceSlug ||
    String(parsed.city ?? "").toLowerCase() !== "bruxelles" ||
    parsed.requestedDay !== requestedDate ||
    String(parsed.requestedTime ?? "").slice(0, 5) !== requestedTime ||
    Number(parsed.budgetMax) !== 100 ||
    !Array.isArray(parsed.missingFields) ||
    parsed.missingFields.length !== 0
  ) {
    throw new Error(
      `KLYX clarified intent analysis is not search-ready: ${JSON.stringify({
        serviceAmbiguous: parsed.serviceAmbiguous,
        serviceSlug: parsed.serviceSlug,
        city: parsed.city,
        requestedDay: parsed.requestedDay,
        requestedTime: parsed.requestedTime,
        budgetMax: parsed.budgetMax,
        missingFields: parsed.missingFields,
      })}`
    );
  }

  const { data: persistedRequest, error: requestError } = await admin
    .from("service_requests")
    .select(
      "id, user_id, raw_text, detected_service_slug, city, requested_day, requested_time, budget_max, status, parsed_payload"
    )
    .eq("id", requestId)
    .single();

  if (requestError) {
    throw new Error(
      `Unable to verify persisted service request: ${requestError.message}`
    );
  }

  if (
    persistedRequest.user_id !== client.id ||
    persistedRequest.raw_text !== intentText ||
    persistedRequest.detected_service_slug !== expectedServiceSlug ||
    String(persistedRequest.city ?? "").toLowerCase() !== "bruxelles" ||
    persistedRequest.requested_day !== requestedDate ||
    String(persistedRequest.requested_time ?? "").slice(0, 5) !==
      requestedTime ||
    Number(persistedRequest.budget_max) !== 100 ||
    persistedRequest.status !== "ready" ||
    persistedRequest.parsed_payload?.serviceAmbiguous !== false
  ) {
    throw new Error("Persisted clarified request does not match KLYX analysis.");
  }

  const searchParams = new URLSearchParams({
    service: parsed.serviceSlug,
    city: parsed.city,
    date: parsed.requestedDay,
    start: requestedTime,
    end: requestedEnd,
    budget: "100",
    pricing: "hourly",
    sort: "recommended",
  });

  const search = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: `/api/search/providers?${searchParams.toString()}`,
    method: "GET",
  });

  if (
    !Array.isArray(search?.providers) ||
    Number(search.exactCount) < 1 ||
    search.showingAlternatives !== false
  ) {
    throw new Error("KLYX provider search did not return an exact match.");
  }

  const matchedProvider = search.providers.find(
    (item) =>
      item.profileId === provider.id &&
      item.userServiceId === expectedUserService.id
  );

  if (!matchedProvider) {
    throw new Error(
      "KLYX provider search did not return the exact golden-path provider fixture."
    );
  }

  if (
    matchedProvider.isExactMatch !== true ||
    matchedProvider.serviceSlug !== expectedServiceSlug ||
    String(matchedProvider.city ?? "").toLowerCase() !== "bruxelles" ||
    matchedProvider.pricingType !== "hourly" ||
    Number(matchedProvider.price) !== 35 ||
    matchedProvider.qualificationApproved !== false ||
    matchedProvider.qualificationLevel !== "self_declared" ||
    matchedProvider.qualificationLabel !==
      "Compétence déclarée par le prestataire"
  ) {
    throw new Error(
      "Golden-path provider match has unexpected search or qualification data."
    );
  }

  for (const privateField of [
    "provider_statement",
    "review_note",
    "reviewed_by",
    "storage_path",
    "source_url",
    "required_proof_types",
    "accepted_proof_types",
  ]) {
    if (Object.prototype.hasOwnProperty.call(matchedProvider, privateField)) {
      throw new Error(
        `Public provider search leaked private qualification field: ${privateField}`
      );
    }
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      ready: true,
      ambiguityClarificationVerified: true,
      initialRequestId,
      requestId,
      serviceSlug: parsed.serviceSlug,
      city: parsed.city,
      requestedDate: parsed.requestedDay,
      requestedTime: String(parsed.requestedTime).slice(0, 5),
      providerProfileId: matchedProvider.profileId,
      userServiceId: matchedProvider.userServiceId,
      exactCount: Number(search.exactCount),
      qualificationApproved: matchedProvider.qualificationApproved,
      qualificationLevel: matchedProvider.qualificationLevel,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path intent search failed: ${message}`);
  process.exitCode = 1;
});

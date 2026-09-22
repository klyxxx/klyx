import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";
const HANDOFF_PATH =
  process.env.KLYX_MISSION19_EARN_HANDOFF_PATH?.trim() ||
  "stripe-network-proof/mission19-earn-handoff.json";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function firstRpcRow(value, label) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object") {
    throw new Error(`${label} returned ${rows.length} rows instead of 1.`);
  }
  return rows[0];
}

function futureBrusselsDate(daysAhead) {
  const parts = new Intl.DateTimeFormat("en-CA", {
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

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + daysAhead,
      12
    )
  )
    .toISOString()
    .slice(0, 10);
}

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method = "GET",
  body,
  expectedStatuses = [200],
}) {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
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
    throw new Error(
      `${method} ${path} returned ${response.status}: ${
        typeof payload?.error === "string" ? payload.error : "unexpected response"
      }`
    );
  }

  return payload;
}

async function transition(admin, {
  workflow,
  accountId,
  toStep,
  eventType,
  payload,
}) {
  const { data, error } = await admin.rpc("klyx_transition_workflow", {
    p_workflow_id: workflow.workflow_id,
    p_account_id: accountId,
    p_expected_version: workflow.version,
    p_to_step: toStep,
    p_event_type: eventType,
    p_actor_type: "server",
    p_payload: payload ?? {},
  });

  if (error) throw new Error(error.message);
  return firstRpcRow(data, `earn transition -> ${toStep}`);
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  invariant(
    localSupabase,
    "Mission 19 earn proof requires ephemeral local Supabase."
  );

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;
  invariant(
    appOrigin === "http://127.0.0.1:3100",
    "Mission 19 earn proof requires isolated KLYX on 127.0.0.1:3100."
  );

  const admin = createClient(
    e2eOrigin,
    requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const userClient = createClient(
    e2eOrigin,
    requiredGoldenPathEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: signIn, error: signInError } =
    await userClient.auth.signInWithPassword({
      email: requiredGoldenPathEnv("KLYX_E2E_EMAIL"),
      password: requiredGoldenPathEnv("KLYX_E2E_PASSWORD"),
    });

  if (signInError || !signIn.session?.access_token || !signIn.user) {
    throw new Error(
      `Mission 19 earn authentication failed: ${
        signInError?.message ?? "missing session"
      }`
    );
  }

  const accessToken = signIn.session.access_token;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(
      "id, account_id, owner_user_id, account_type, country_code, currency_code"
    )
    .eq("owner_user_id", signIn.user.id);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((row) => row.account_type === "client");
  const provider = (profiles ?? []).find(
    (row) => row.account_type === "provider"
  );
  invariant(client?.id && provider?.id, "Mission 19 earn profiles missing.");

  let accountId = provider.account_id;
  if (!accountId) {
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id")
      .eq("auth_user_id", signIn.user.id)
      .single();
    if (accountError) throw new Error(accountError.message);
    accountId = account.id;
  }
  invariant(accountId, "Mission 19 earn canonical account missing.");

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, service_id, active, provider_enabled, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .limit(1)
    .single();
  if (userServiceError) throw new Error(userServiceError.message);

  const serviceRelation = Array.isArray(userService.services)
    ? userService.services[0]
    : userService.services;
  const serviceSlug = serviceRelation?.slug;
  invariant(
    typeof serviceSlug === "string" && serviceSlug.length > 0,
    "Mission 19 earn service slug missing."
  );

  const [{ data: providerProfile, error: providerProfileError }, {
    data: zone,
    error: zoneError,
  }] = await Promise.all([
    admin
      .from("provider_profiles")
      .select("profile_id, is_published")
      .eq("profile_id", provider.id)
      .eq("is_published", true)
      .single(),
    admin
      .from("provider_service_zones")
      .select("id, locality, country_code, is_active")
      .eq("profile_id", provider.id)
      .eq("user_service_id", userService.id)
      .eq("is_active", true)
      .limit(1)
      .single(),
  ]);
  if (providerProfileError) throw new Error(providerProfileError.message);
  if (zoneError) throw new Error(zoneError.message);
  invariant(
    providerProfile?.is_published === true && zone?.id,
    "Mission 19 earn provider is not market-eligible."
  );

  const runMarker = `mission19-earn-${randomUUID()}`;
  const { data: workflowData, error: workflowError } = await admin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: accountId,
      p_profile_id: provider.id,
      p_conversation_id: null,
      p_mode: "earn",
      p_context: {
        mission19_earn_run: runMarker,
        service_slug: serviceSlug,
      },
    }
  );
  if (workflowError) throw new Error(workflowError.message);

  let workflow = firstRpcRow(workflowData, "earn workflow create");
  invariant(
    workflow.current_step === "skill" && workflow.status === "active",
    "Earn workflow did not start at skill."
  );

  const bookingDate = futureBrusselsDate(35);
  const startTime = "10:00";
  const endTime = "12:00";
  const offerAmount = 70;

  const createdRequest = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/market/requests",
    method: "POST",
    body: {
      serviceSlug,
      title: "Mission 19 earn runtime proof",
      description:
        "Demande éphémère servant à certifier le cycle prestataire KLYX de bout en bout.",
      city: zone.locality || "Bruxelles",
      requestedDate: bookingDate,
      requestedTime: startTime,
      budgetMax: 100,
    },
  });

  const requestId = createdRequest?.request?.id;
  invariant(
    typeof requestId === "string" && requestId.length > 0,
    "Mission 19 earn market request creation failed."
  );

  const jobs = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/provider/jobs",
  });
  const opportunities = Array.isArray(jobs?.requests)
    ? jobs.requests
    : Array.isArray(jobs?.jobs)
      ? jobs.jobs
      : [];
  const opportunity = opportunities.find((item) => item?.id === requestId);
  invariant(
    opportunity,
    "Created market request did not become a real provider opportunity."
  );
  invariant(
    jobs?.automaticOffer !== true &&
      jobs?.automaticBooking !== true &&
      jobs?.automaticPayment !== true &&
      jobs?.automaticExecutionAllowed !== true,
    "Provider opportunity endpoint crossed an automatic sensitive-action boundary."
  );

  workflow = await transition(admin, {
    workflow,
    accountId,
    toStep: "opportunities",
    eventType: "earn_opportunity_discovered",
    payload: {
      market_request_id: requestId,
      user_service_id: userService.id,
    },
  });

  invariant(
    userService.active === true &&
      userService.provider_enabled === true &&
      providerProfile.is_published === true &&
      zone.is_active === true,
    "Provider eligibility facts changed before proposal."
  );

  workflow = await transition(admin, {
    workflow,
    accountId,
    toStep: "eligibility",
    eventType: "earn_activity_eligibility_verified",
    payload: {
      market_request_id: requestId,
      user_service_id: userService.id,
      provider_zone_id: zone.id,
      evidence: "active_service_published_profile_active_zone",
    },
  });

  const offerPayload = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: `/api/market/requests/${requestId}/offers`,
    method: "POST",
    body: {
      amount: offerAmount,
      message: "Mission 19 provider proposal.",
    },
  });
  const offerId = offerPayload?.offer?.id;
  invariant(
    typeof offerId === "string" && offerPayload?.offer?.status === "sent",
    "Mission 19 earn provider proposal was not persisted."
  );

  workflow = await transition(admin, {
    workflow,
    accountId,
    toStep: "proposal",
    eventType: "earn_proposal_sent",
    payload: {
      market_request_id: requestId,
      offer_id: offerId,
      amount: offerAmount,
      currency: offerPayload.offer.currency,
    },
  });

  const acceptance = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: `/api/market/requests/${requestId}/offers`,
    method: "PATCH",
    body: {
      offerId,
      action: "accept",
    },
  });
  const quoteId = acceptance?.quoteId;
  invariant(
    typeof quoteId === "string" && quoteId.length > 0,
    "Mission 19 earn offer acceptance did not create an accepted quote."
  );

  const [{ data: acceptedOffer, error: acceptedOfferError }, {
    data: matchedRequest,
    error: matchedRequestError,
  }, {
    data: acceptedQuote,
    error: acceptedQuoteError,
  }, {
    count: prematureBookings,
    error: prematureBookingError,
  }] = await Promise.all([
    admin
      .from("market_service_offers")
      .select("id, status")
      .eq("id", offerId)
      .single(),
    admin
      .from("market_service_requests")
      .select("id, status, accepted_offer_id")
      .eq("id", requestId)
      .single(),
    admin
      .from("service_quotes")
      .select("id, status, provider_profile_id, market_request_id")
      .eq("id", quoteId)
      .single(),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quoteId),
  ]);
  if (acceptedOfferError) throw new Error(acceptedOfferError.message);
  if (matchedRequestError) throw new Error(matchedRequestError.message);
  if (acceptedQuoteError) throw new Error(acceptedQuoteError.message);
  if (prematureBookingError) throw new Error(prematureBookingError.message);

  invariant(
    acceptedOffer.status === "accepted" &&
      matchedRequest.status === "matched" &&
      matchedRequest.accepted_offer_id === offerId &&
      acceptedQuote.status === "accepted" &&
      acceptedQuote.provider_profile_id === provider.id &&
      acceptedQuote.market_request_id === requestId,
    "Mission 19 earn acceptance truth is inconsistent."
  );
  invariant(
    prematureBookings === 0,
    "Offer acceptance automatically created a booking without explicit client action."
  );

  workflow = await transition(admin, {
    workflow,
    accountId,
    toStep: "acceptance",
    eventType: "earn_proposal_accepted",
    payload: {
      market_request_id: requestId,
      offer_id: offerId,
      quote_id: quoteId,
    },
  });

  const bookingPayload = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/create",
    method: "POST",
    body: {
      providerId: provider.id,
      serviceSlug,
      bookingDate,
      startTime,
      endTime,
      quoteId,
      message: "Mission 19 earn booking from accepted provider proposal.",
    },
  });
  const bookingId = bookingPayload?.bookingId;
  invariant(
    typeof bookingId === "string" && bookingPayload?.quoteApplied === true,
    "Mission 19 earn accepted quote did not create the canonical booking."
  );

  const acceptedBookingResponse = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/status",
    method: "POST",
    body: {
      bookingId,
      status: "accepted",
      note: "Mission 19 provider explicitly accepted the mission.",
    },
  });
  invariant(
    acceptedBookingResponse?.status === "accepted",
    "Provider mission acceptance did not persist."
  );

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, quote_id, status, payment_status, service_status, amount_total, currency"
    )
    .eq("id", bookingId)
    .single();
  if (bookingError) throw new Error(bookingError.message);

  invariant(
    booking.provider_id === provider.id &&
      booking.quote_id === quoteId &&
      booking.status === "accepted" &&
      booking.payment_status === "unpaid",
    "Mission 19 earn booking authority is inconsistent."
  );

  workflow = await transition(admin, {
    workflow,
    accountId,
    toStep: "mission",
    eventType: "earn_mission_accepted",
    payload: {
      market_request_id: requestId,
      offer_id: offerId,
      quote_id: quoteId,
      booking_id: bookingId,
    },
  });

  fs.mkdirSync("stripe-network-proof", { recursive: true });
  fs.writeFileSync(
    HANDOFF_PATH,
    `${JSON.stringify(
      {
        mission19Earn: true,
        runMarker,
        accountId,
        clientProfileId: client.id,
        providerProfileId: provider.id,
        userServiceId: userService.id,
        serviceSlug,
        marketRequestId: requestId,
        offerId,
        quoteId,
        bookingId,
        workflowId: workflow.workflow_id,
        workflowVersion: Number(workflow.version),
        workflowStep: workflow.current_step,
        bookingDate,
        startTime,
        endTime,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  invariant(
    workflow.current_step === "mission",
    "Mission 19 earn workflow did not reach mission."
  );

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      earnMarketLifecyclePrepared: true,
      workflowId: workflow.workflow_id,
      marketRequestId: requestId,
      offerId,
      quoteId,
      bookingId,
      workflowStep: workflow.current_step,
      automaticSensitiveExecutionAllowed: false,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Mission 19 earn market proof failed: ${message}`);
  process.exitCode = 1;
});

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

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

async function requestJson({
  appOrigin,
  accessToken,
  profileId,
  path,
  method,
  body,
  expectedStatuses = [200],
}) {
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}`,
      "Content-Type": "application/json",
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
    const safeMessage =
      payload && typeof payload.error === "string"
        ? payload.error
        : "unexpected response";

    throw new Error(
      `${method} ${path} returned ${response.status}: ${safeMessage}`
    );
  }

  return {
    status: response.status,
    payload,
  };
}

function requireId(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} is missing from the golden-path response.`);
  }

  return value;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();

  if (!localSupabase) {
    throw new Error(
      "Golden-path client lifecycle is allowed only on ephemeral local Supabase."
    );
  }

  const appOrigin = new URL(
    requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")
  ).origin;

  if (appOrigin !== "http://127.0.0.1:3100") {
    throw new Error(
      "Golden-path client lifecycle requires the isolated local KLYX server on 127.0.0.1:3100."
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

  const {
    data: signInData,
    error: signInError,
  } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

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
    .select("id, account_type, country_code, currency_code")
    .eq("owner_user_id", signInData.user.id);

  if (profilesError) {
    throw new Error(`Unable to load golden-path profiles: ${profilesError.message}`);
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

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, service_id, active, provider_enabled, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .maybeSingle();

  if (userServiceError || !userService) {
    throw new Error(
      `Unable to resolve the bookable provider service: ${
        userServiceError?.message ?? "missing fixture"
      }`
    );
  }

  const serviceRelation = Array.isArray(userService.services)
    ? userService.services[0]
    : userService.services;
  const serviceSlug = serviceRelation?.slug;

  if (typeof serviceSlug !== "string" || !serviceSlug) {
    throw new Error("Golden-path provider service slug is missing.");
  }

  const bookingDate = futureBrusselsDate(14);
  const startTime = "10:00";
  const endTime = "12:00";

  const quoteCreate = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/quotes",
    method: "POST",
    body: {
      providerProfileId: provider.id,
      userServiceId: userService.id,
      title: "Golden path ménage KLYX",
      description:
        "Demande éphémère créée par le golden path pour vérifier le devis puis la réservation KLYX.",
      requestedDate: bookingDate,
      requestedTime: startTime,
      durationHours: 2,
    },
  });

  const quoteId = requireId(quoteCreate.payload?.quote?.id, "quoteId");

  const { count: messagesBeforeDraft, error: messagesBeforeDraftError } =
    await admin.from("messages").select("id", { count: "exact", head: true });

  if (messagesBeforeDraftError) {
    throw new Error(
      `Unable to count messages before smart quote draft: ${messagesBeforeDraftError.message}`
    );
  }

  const smartDraftResponse = await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/provider/quotes/draft",
    method: "POST",
    body: { quoteId },
  });

  const smartDraft = smartDraftResponse.payload?.draft;

  if (
    !smartDraft ||
    smartDraft.providerPrice !== 70 ||
    smartDraft.requiresConfirmation !== true ||
    smartDraft.riskLevel !== "review_required" ||
    smartDraft.source !== "quote_snapshot"
  ) {
    throw new Error("Smart quote draft did not preserve the provider review boundary.");
  }

  const { data: quoteAfterDraft, error: quoteAfterDraftError } = await admin
    .from("service_quotes")
    .select("status, provider_price, provider_message")
    .eq("id", quoteId)
    .single();

  if (quoteAfterDraftError) {
    throw new Error(
      `Unable to verify quote after smart draft: ${quoteAfterDraftError.message}`
    );
  }

  if (
    quoteAfterDraft.status !== "requested" ||
    quoteAfterDraft.provider_price !== null ||
    quoteAfterDraft.provider_message !== null
  ) {
    throw new Error("Smart quote draft mutated the canonical quote before provider send.");
  }

  const { count: bookingsAfterDraft, error: bookingsAfterDraftError } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quoteId);

  if (bookingsAfterDraftError) {
    throw new Error(
      `Unable to verify booking isolation after smart draft: ${bookingsAfterDraftError.message}`
    );
  }

  if ((bookingsAfterDraft ?? 0) !== 0) {
    throw new Error("Smart quote draft created a booking before explicit quote acceptance.");
  }

  const { count: messagesAfterDraft, error: messagesAfterDraftError } =
    await admin.from("messages").select("id", { count: "exact", head: true });

  if (messagesAfterDraftError) {
    throw new Error(
      `Unable to count messages after smart quote draft: ${messagesAfterDraftError.message}`
    );
  }

  if (messagesAfterDraft !== messagesBeforeDraft) {
    throw new Error("Smart quote draft created a message before explicit provider send.");
  }

  const { data: storedDraft, error: storedDraftError } = await admin
    .from("provider_assistant_drafts")
    .select("id, draft_type, status, payload")
    .eq("profile_id", provider.id)
    .eq("draft_type", "quote")
    .eq("status", "draft")
    .contains("payload", { quoteId })
    .maybeSingle();

  if (storedDraftError || !storedDraft) {
    throw new Error(
      `Unable to verify private smart quote draft: ${
        storedDraftError?.message ?? "missing draft"
      }`
    );
  }

  if (
    storedDraft.payload?.requiresConfirmation !== true ||
    storedDraft.payload?.riskLevel !== "review_required"
  ) {
    throw new Error("Stored smart quote draft lost its explicit review requirement.");
  }

  await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/quotes",
    method: "PATCH",
    body: {
      quoteId,
      action: "send",
      providerPrice: 70,
      providerMessage:
        "Prix golden path : deux heures de ménage à Bruxelles.",
    },
  });

  await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/quotes",
    method: "PATCH",
    body: {
      quoteId,
      action: "accept",
    },
  });

  const bookingCreate = await requestJson({
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
      message:
        "Réservation golden path créée depuis le devis accepté.",
      quoteId,
    },
  });

  const bookingId = requireId(
    bookingCreate.payload?.bookingId,
    "bookingId"
  );

  if (bookingCreate.payload?.quoteApplied !== true) {
    throw new Error("Booking was not created from the accepted quote.");
  }

  if (bookingCreate.payload?.estimatedAmountCents !== 7000) {
    throw new Error(
      `Expected accepted quote amount 7000 cents, received ${String(
        bookingCreate.payload?.estimatedAmountCents
      )}.`
    );
  }

  const duplicateBooking = await requestJson({
    appOrigin,
    accessToken,
    profileId: client.id,
    path: "/api/bookings/create",
    method: "POST",
    expectedStatuses: [409],
    body: {
      providerId: provider.id,
      serviceSlug,
      bookingDate,
      startTime,
      endTime,
      message: "Duplicate quote-use probe.",
      quoteId,
    },
  });

  if (duplicateBooking.payload?.bookingId !== bookingId) {
    throw new Error(
      "Accepted quote reuse did not resolve to the already-created booking."
    );
  }

  await requestJson({
    appOrigin,
    accessToken,
    profileId: provider.id,
    path: "/api/bookings/status",
    method: "POST",
    body: {
      bookingId,
      status: "accepted",
      note: "Golden path provider acceptance.",
    },
  });

  const { data: quote, error: quoteError } = await admin
    .from("service_quotes")
    .select("id, status, provider_price, client_profile_id, provider_profile_id")
    .eq("id", quoteId)
    .single();

  if (quoteError) {
    throw new Error(`Unable to verify golden-path quote: ${quoteError.message}`);
  }

  if (
    quote.status !== "accepted" ||
    Number(quote.provider_price) !== 70 ||
    quote.client_profile_id !== client.id ||
    quote.provider_profile_id !== provider.id
  ) {
    throw new Error("Golden-path quote final state is invalid.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, quote_id, parent_id, provider_id, status, payment_status, service_status, estimated_amount_cents, amount_total, currency"
    )
    .eq("id", bookingId)
    .single();

  if (bookingError) {
    throw new Error(
      `Unable to verify golden-path booking: ${bookingError.message}`
    );
  }

  if (
    booking.quote_id !== quoteId ||
    booking.parent_id !== client.id ||
    booking.provider_id !== provider.id ||
    booking.status !== "accepted" ||
    booking.payment_status !== "unpaid" ||
    booking.service_status !== "scheduled" ||
    Number(booking.estimated_amount_cents) !== 7000 ||
    Number(booking.amount_total) !== 7000 ||
    booking.currency !== "EUR"
  ) {
    throw new Error("Golden-path booking final state is invalid.");
  }

  const { data: events, error: eventsError } = await admin
    .from("booking_status_events")
    .select("new_status")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(
      `Unable to verify booking status events: ${eventsError.message}`
    );
  }

  const statuses = (events ?? []).map((event) => event.new_status);

  if (!statuses.includes("pending") || !statuses.includes("accepted")) {
    throw new Error(
      "Golden-path booking status event history is incomplete."
    );
  }

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      smartQuoteDraftVerified: true,
      readyForPayment: true,
      quoteStatus: quote.status,
      bookingStatus: booking.status,
      paymentStatus: booking.payment_status,
      amountTotal: Number(booking.amount_total),
      currency: booking.currency,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX golden-path client lifecycle failed: ${message}`);
  process.exitCode = 1;
});

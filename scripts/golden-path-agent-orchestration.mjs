import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const ACTIVE_PROFILE_COOKIE = "klyx_active_profile";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonResponse(response, label) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}: ${payload?.error ?? "unknown error"}`);
  }
  return payload;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  expect(localSupabase, "Agent orchestration proof requires ephemeral local Supabase.");

  const appOrigin = new URL(requiredGoldenPathEnv("NEXT_PUBLIC_APP_URL")).origin;
  expect(
    appOrigin === "http://127.0.0.1:3100",
    "Agent orchestration proof requires the isolated local production server."
  );

  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = createClient(e2eOrigin, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signIn, error: signInError } = await user.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session?.access_token || !signIn.user) {
    throw new Error("Unable to authenticate agent orchestration golden account.");
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signIn.user.id);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((profile) => profile.account_type === "client");
  const provider = (profiles ?? []).find((profile) => profile.account_type === "provider");
  expect(Boolean(client), "Golden client profile is missing.");
  expect(Boolean(provider), "Golden provider profile is missing.");

  const headers = {
    Authorization: `Bearer ${signIn.session.access_token}`,
    Cookie: `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(client.id)}`,
    "Content-Type": "application/json",
  };

  const { count: bookingsBefore, error: bookingsBeforeError } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", client.id);
  if (bookingsBeforeError) throw new Error(bookingsBeforeError.message);

  let planId = null;

  try {
    const createResponse = await fetch(`${appOrigin}/api/agent/plans`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        request:
          "Organise un ménage demain à 10h à Bruxelles pendant 2 heures pour 70 € maximum.",
      }),
    });
    const created = await jsonResponse(createResponse, "POST /api/agent/plans");
    const plan = created?.plan;

    expect(Boolean(plan?.id), "Agent plan creation did not return an id.");
    planId = plan.id;
    expect(plan.plan_status === "ready", "Golden agent plan must be search-ready.");
    expect(plan.next_action === "search", "Golden agent plan must delegate search to KLYX.");

    const executeResponse = await fetch(`${appOrigin}/api/agent/plans/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ planId }),
    });
    const executed = await jsonResponse(
      executeResponse,
      "POST /api/agent/plans/execute"
    );

    expect(executed.reused === false, "First agent execution must not be a reuse.");
    expect(
      executed.requiresConfirmation === "book",
      "Agent must stop for explicit booking confirmation."
    );
    expect(
      executed.plan?.selected_provider_id === provider.id,
      "Agent did not choose the expected exact golden provider."
    );
    expect(
      typeof executed.plan?.selected_user_service_id === "string" &&
        executed.plan.selected_user_service_id.length > 0,
      "Agent did not persist the selected provider service."
    );
    expect(
      executed.plan?.execution_status === "waiting_confirmation" &&
        executed.plan?.next_action === "book",
      "Agent did not persist booking confirmation state."
    );
    expect(
      typeof executed.plan?.next_action_href === "string" &&
        executed.plan.next_action_href.startsWith(`/providers/${provider.id}/book?`),
      "Agent did not prepare the canonical provider booking link."
    );

    const steps = Array.isArray(executed.plan?.steps) ? executed.plan.steps : [];
    const step = (id) => steps.find((candidate) => candidate.id === id);
    expect(step("search")?.status === "completed", "Agent search step is not completed.");
    expect(step("choose")?.status === "completed", "Agent choose step is not completed.");
    expect(
      step("book")?.status === "ready" && step("book")?.requiresConfirmation === true,
      "Booking must remain a user-confirmed ready step."
    );
    expect(
      step("pay")?.status === "pending" && step("pay")?.requiresConfirmation === true,
      "Payment must remain pending and explicitly confirmed."
    );

    const revision = executed.plan.execution_revision;
    expect(Number(revision) === 1, "First agent execution revision must be 1.");

    const retryResponse = await fetch(`${appOrigin}/api/agent/plans/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ planId }),
    });
    const retried = await jsonResponse(
      retryResponse,
      "retry POST /api/agent/plans/execute"
    );
    expect(retried.reused === true, "Agent retry must reuse persisted choice.");
    expect(
      Number(retried.plan?.execution_revision) === Number(revision),
      "Agent retry must not increment the execution revision."
    );
    expect(
      retried.plan?.selected_provider_id === provider.id,
      "Agent retry changed the selected provider."
    );

    const { data: events, error: eventsError } = await admin
      .from("client_agent_plan_events")
      .select("event_type, execution_revision, step_id")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });
    if (eventsError) throw new Error(eventsError.message);

    const eventTypes = (events ?? []).map((event) => event.event_type);
    expect(events?.length === 4, "Agent execution journal must contain exactly four events.");
    for (const eventType of [
      "search_started",
      "search_succeeded",
      "provider_selected",
      "confirmation_required",
    ]) {
      expect(eventTypes.includes(eventType), `Agent journal is missing ${eventType}.`);
    }
    expect(
      (events ?? []).every((event) => Number(event.execution_revision) === Number(revision)),
      "Agent journal contains an unexpected execution revision."
    );

    const { count: bookingsAfter, error: bookingsAfterError } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", client.id);
    if (bookingsAfterError) throw new Error(bookingsAfterError.message);
    expect(
      Number(bookingsAfter ?? 0) === Number(bookingsBefore ?? 0),
      "Agent search/choice execution must not create a booking before confirmation."
    );

    process.stdout.write(
      `${JSON.stringify({
        agentSearchChoiceVerified: true,
        planId,
        selectedProviderId: provider.id,
        executionRevision: revision,
        executionRetryReused: true,
        journalEvents: eventTypes,
        bookingConfirmationRequired: true,
        bookingCreatedAutomatically: false,
        paymentTriggeredAutomatically: false,
        localSupabaseOnly: true,
      })}\n`
    );
  } finally {
    if (planId) {
      await admin.from("client_agent_plans").delete().eq("id", planId);
    }
    await user.auth.signOut();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX agent orchestration golden proof failed: ${message}`);
  process.exitCode = 1;
});

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function rpcRow(data, label) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) {
    throw new Error(`${label} returned ${rows.length} rows instead of 1.`);
  }
  return rows[0];
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  invariant(localSupabase, "Mission 19 earn proof requires local Supabase.");

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
  if (signInError || !signIn.user) {
    throw new Error(
      `Mission 19 earn authentication failed: ${signInError?.message ?? "missing user"}`
    );
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_id, account_type")
    .eq("owner_user_id", signIn.user.id);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((p) => p.account_type === "client");
  const provider = (profiles ?? []).find((p) => p.account_type === "provider");
  invariant(client?.id, "Mission 19 earn client profile missing.");
  invariant(provider?.id, "Mission 19 earn provider profile missing.");
  invariant(provider.account_id, "Mission 19 earn provider account missing.");

  const accountId = provider.account_id;

  const { data: capability, error: capabilityError } = await admin
    .from("account_actor_capabilities")
    .select("enabled")
    .eq("account_id", accountId)
    .eq("capability", "offer_services")
    .single();
  if (capabilityError) throw new Error(capabilityError.message);
  invariant(
    capability.enabled === true,
    "Mission 19 earn eligibility requires offer_services capability."
  );

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, user_service_id, service_id, status, payment_status, service_status, completed_at"
    )
    .eq("parent_id", client.id)
    .eq("provider_id", provider.id)
    .eq("status", "completed")
    .eq("payment_status", "paid")
    .eq("service_status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();
  if (bookingError) throw new Error(bookingError.message);
  invariant(booking.user_service_id, "Mission 19 earn skill identity missing.");
  invariant(booking.completed_at, "Mission 19 earn completion timestamp missing.");

  const { data: settlement, error: settlementError } = await admin
    .from("booking_settlements")
    .select("state, stripe_transfer_id")
    .eq("booking_id", booking.id)
    .maybeSingle();
  if (settlementError) throw new Error(settlementError.message);
  invariant(
    !settlement ||
      settlement.state !== "released" ||
      !settlement.stripe_transfer_id,
    "Local earn boundary fixture unexpectedly already has released Settlement truth."
  );

  const { data: skill, error: skillError } = await admin
    .from("user_services")
    .select("id, user_id, active, provider_enabled")
    .eq("id", booking.user_service_id)
    .eq("user_id", provider.id)
    .single();
  if (skillError) throw new Error(skillError.message);
  invariant(
    skill.active === true && skill.provider_enabled === true,
    "Mission 19 earn provider skill is not active."
  );

  const { data: conversation, error: conversationError } = await admin
    .from("brain_conversations")
    .insert({
      user_id: provider.id,
      title: "Mission 19 earn lifecycle certification",
    })
    .select("id")
    .single();
  if (conversationError) throw new Error(conversationError.message);

  const marker = `mission19-earn-${randomUUID()}`;
  const { data: createdData, error: createdError } = await admin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: accountId,
      p_profile_id: provider.id,
      p_conversation_id: conversation.id,
      p_mode: "earn",
      p_context: {
        mission19_run: marker,
        provider_profile_id: provider.id,
        booking_id: booking.id,
        realized_opportunity_booking_id: booking.id,
        user_service_id: skill.id,
        eligibility_capability: "offer_services",
      },
    }
  );
  if (createdError) throw new Error(createdError.message);

  let workflow = rpcRow(createdData, "earn workflow create");
  invariant(workflow.current_step === "skill", "Earn workflow did not start at skill.");
  invariant(workflow.status === "active", "Earn workflow did not start active.");

  const transitions = [
    ["opportunities", { booking_id: booking.id, user_service_id: skill.id }],
    ["eligibility", { capability: "offer_services", enabled: true }],
    ["proposal", { booking_id: booking.id }],
    ["acceptance", { booking_id: booking.id, accepted: true }],
    ["mission", { booking_id: booking.id }],
    [
      "completion",
      {
        booking_id: booking.id,
        booking_status: booking.status,
        service_status: booking.service_status,
        completed_at: booking.completed_at,
      },
    ],
    [
      "settlement",
      {
        booking_id: booking.id,
        payment_status: booking.payment_status,
        settlement_boundary: "server_controlled",
      },
    ],
  ];

  for (const [toStep, payload] of transitions) {
    const { data, error } = await admin.rpc("klyx_transition_workflow", {
      p_workflow_id: workflow.workflow_id,
      p_account_id: accountId,
      p_expected_version: workflow.version,
      p_to_step: toStep,
      p_event_type: `mission19_earn_${toStep}`,
      p_actor_type: "server",
      p_payload: payload,
    });
    if (error) throw new Error(error.message);

    workflow = rpcRow(data, `earn transition ${toStep}`);
    invariant(
      workflow.current_step === toStep,
      `Earn workflow did not persist ${toStep}.`
    );
    invariant(
      workflow.status === "active",
      `Earn workflow became terminal before settlement completion at ${toStep}.`
    );
  }

  const { error: prematureCompletionError } = await admin.rpc(
    "klyx_complete_settlement_workflow",
    {
      p_workflow_id: workflow.workflow_id,
      p_account_id: accountId,
      p_expected_version: workflow.version,
      p_event_type: "mission19_earn_premature_settlement_completion",
      p_actor_type: "server",
      p_payload: {
        booking_id: booking.id,
        claimed_settlement_truth: "released",
      },
    }
  );
  invariant(
    prematureCompletionError?.message?.includes(
      "KLYX_WORKFLOW_SETTLEMENT_TRUTH_NOT_RELEASED"
    ) === true,
    `Earn workflow did not fail closed before canonical Settlement release: ${prematureCompletionError?.message ?? "no error"}.`
  );

  const { data: steps, error: stepsError } = await admin
    .from("klyx_workflow_steps")
    .select("step, ordinal, exited_at")
    .eq("workflow_id", workflow.workflow_id)
    .order("ordinal", { ascending: true });
  if (stepsError) throw new Error(stepsError.message);

  const expectedSteps = [
    "skill",
    "opportunities",
    "eligibility",
    "proposal",
    "acceptance",
    "mission",
    "completion",
    "settlement",
  ];
  const actualSteps = (steps ?? []).map((row) => row.step);

  invariant(
    JSON.stringify(actualSteps) === JSON.stringify(expectedSteps),
    `Earn workflow step order mismatch: ${actualSteps.join(" -> ")}.`
  );
  invariant(
    (steps ?? []).slice(0, -1).every((row) => row.exited_at) &&
      steps?.at(-1)?.step === "settlement" &&
      !steps?.at(-1)?.exited_at,
    "Earn workflow settlement boundary did not remain open after blocked completion."
  );

  const { data: finalWorkflow, error: finalWorkflowError } = await admin
    .from("klyx_workflows")
    .select("status, current_step, completed_at, context")
    .eq("id", workflow.workflow_id)
    .single();
  if (finalWorkflowError) throw new Error(finalWorkflowError.message);

  invariant(
    finalWorkflow.status === "active" &&
      finalWorkflow.current_step === "settlement" &&
      !finalWorkflow.completed_at,
    "Earn workflow became terminal without canonical Settlement truth."
  );
  invariant(
    finalWorkflow.context?.booking_id === booking.id &&
      finalWorkflow.context?.realized_opportunity_booking_id === booking.id,
    "Earn workflow lost its canonical booking opportunity identity."
  );

  const { count: terminalEventCount, error: terminalEventError } = await admin
    .from("klyx_workflow_events")
    .select("id", { count: "exact", head: true })
    .eq("workflow_id", workflow.workflow_id)
    .eq("event_type", "mission19_earn_premature_settlement_completion");
  if (terminalEventError) throw new Error(terminalEventError.message);
  invariant(
    terminalEventCount === 0,
    "Blocked settlement completion appended a false terminal audit event."
  );

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      earnLifecycleBoundaryProofPassed: true,
      workflowId: workflow.workflow_id,
      bookingId: booking.id,
      userServiceId: skill.id,
      capability: "offer_services",
      steps: expectedSteps,
      currentStep: finalWorkflow.current_step,
      terminalStatus: finalWorkflow.status,
      settlementCompletionBlocked: true,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Mission 19 earn lifecycle proof failed: ${message}`);
  process.exitCode = 1;
});

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

async function transition(admin, accountId, workflow, toStep, payload = {}) {
  const { data, error } = await admin.rpc("klyx_transition_workflow", {
    p_workflow_id: workflow.workflow_id,
    p_account_id: accountId,
    p_expected_version: Number(workflow.version),
    p_to_step: toStep,
    p_event_type: `mission19_earn_${toStep}`,
    p_actor_type: "server",
    p_payload: payload,
  });

  if (error) throw new Error(error.message);
  return rpcRow(data, `earn transition ${workflow.current_step}->${toStep}`);
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  invariant(localSupabase, "Mission 19 GAGNER proof requires local Supabase.");

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
      `Mission 19 GAGNER authentication failed: ${signInError?.message ?? "missing user"}`
    );
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", signIn.user.id)
    .single();
  if (accountError || !account?.id) {
    throw new Error(accountError?.message ?? "Mission 19 account missing.");
  }

  const { data: provider, error: providerError } = await admin
    .from("profiles")
    .select("id")
    .eq("owner_user_id", signIn.user.id)
    .eq("account_type", "provider")
    .single();
  if (providerError || !provider?.id) {
    throw new Error(providerError?.message ?? "Mission 19 provider missing.");
  }

  const { data: providerService, error: serviceError } = await admin
    .from("user_services")
    .select("id, service_id")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .limit(1)
    .maybeSingle();
  if (serviceError) throw new Error(serviceError.message);
  invariant(providerService?.id, "Mission 19 provider has no active skill/service.");

  const { data: conversation, error: conversationError } = await admin
    .from("brain_conversations")
    .insert({
      user_id: provider.id,
      title: "Mission 19 GAGNER lifecycle certification",
    })
    .select("id")
    .single();
  if (conversationError) throw new Error(conversationError.message);

  const { data: createdData, error: createdError } = await admin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: account.id,
      p_profile_id: provider.id,
      p_conversation_id: conversation.id,
      p_mode: "earn",
      p_context: {
        mission19: true,
        certification: "gagner_lifecycle",
        user_service_id: providerService.id,
        service_id: providerService.service_id,
      },
    }
  );
  if (createdError) throw new Error(createdError.message);

  let workflow = rpcRow(createdData, "earn workflow create");
  invariant(workflow.current_step === "skill", "GAGNER did not start at skill.");

  const orderedTransitions = [
    "opportunities",
    "eligibility",
    "proposal",
    "acceptance",
    "mission",
  ];

  for (const step of orderedTransitions) {
    workflow = await transition(admin, account.id, workflow, step, {
      mission19: true,
      provider_profile_id: provider.id,
      user_service_id: providerService.id,
    });
    invariant(
      workflow.current_step === step,
      `GAGNER transition did not persist ${step}.`
    );
  }

  // Settlement is forbidden before explicit completion.
  const { error: skippedCompletionError } = await admin.rpc(
    "klyx_transition_workflow",
    {
      p_workflow_id: workflow.workflow_id,
      p_account_id: account.id,
      p_expected_version: Number(workflow.version),
      p_to_step: "settlement",
      p_event_type: "mission19_illegal_settlement_skip",
      p_actor_type: "server",
      p_payload: { mission19: true },
    }
  );
  invariant(
    skippedCompletionError?.message?.includes("KLYX_WORKFLOW_TRANSITION_INVALID"),
    "GAGNER allowed mission -> settlement without completion."
  );

  workflow = await transition(admin, account.id, workflow, "completion", {
    mission19: true,
    mission_completed: true,
  });
  invariant(
    workflow.current_step === "completion",
    "GAGNER completion boundary was not persisted."
  );

  workflow = await transition(admin, account.id, workflow, "settlement", {
    mission19: true,
    settlement_authorization_required: true,
  });
  invariant(
    workflow.current_step === "settlement" && workflow.status === "active",
    "GAGNER did not enter active settlement state."
  );

  const { data: completedData, error: completedError } = await admin.rpc(
    "klyx_complete_settlement_workflow",
    {
      p_workflow_id: workflow.workflow_id,
      p_account_id: account.id,
      p_expected_version: Number(workflow.version),
      p_event_type: "mission19_earn_settlement_completed",
      p_actor_type: "server",
      p_payload: { mission19: true },
    }
  );
  if (completedError) throw new Error(completedError.message);
  const completed = rpcRow(completedData, "earn settlement completion");

  invariant(
    completed.current_step === "settlement" && completed.status === "completed",
    "GAGNER settlement did not terminate the workflow."
  );

  const { data: steps, error: stepsError } = await admin
    .from("klyx_workflow_steps")
    .select("step, ordinal")
    .eq("workflow_id", workflow.workflow_id)
    .order("ordinal", { ascending: true });
  if (stepsError) throw new Error(stepsError.message);

  const stepNames = (steps ?? []).map((row) => row.step);
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

  invariant(
    JSON.stringify(stepNames) === JSON.stringify(expectedSteps),
    `GAGNER persisted lifecycle mismatch: ${JSON.stringify(stepNames)}.`
  );

  const { data: events, error: eventsError } = await admin
    .from("klyx_workflow_events")
    .select("event_type, step, workflow_version")
    .eq("workflow_id", workflow.workflow_id)
    .order("created_at", { ascending: true });
  if (eventsError) throw new Error(eventsError.message);

  invariant(
    (events ?? []).some(
      (event) =>
        event.event_type === "mission19_earn_completion" &&
        event.step === "completion"
    ),
    "GAGNER completion audit event is missing."
  );
  invariant(
    (events ?? []).some(
      (event) =>
        event.event_type === "mission19_earn_settlement_completed" &&
        event.step === "settlement"
    ),
    "GAGNER settlement completion audit event is missing."
  );

  await userClient.auth.signOut();

  process.stdout.write(
    `${JSON.stringify({
      mission19EarnLifecyclePassed: true,
      workflowId: workflow.workflow_id,
      providerProfileId: provider.id,
      steps: expectedSteps,
      directMissionToSettlementRejected: true,
      settlementTerminal: true,
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Mission 19 GAGNER lifecycle proof failed: ${message}`);
  process.exitCode = 1;
});

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const RUNTIME_REPORT_PATH = "klyx-complete-engine-runtime-report.json";

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

async function createConversation(admin, profileId, title) {
  const { data, error } = await admin
    .from("brain_conversations")
    .insert({ user_id: profileId, title })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(`Unable to create certification conversation: ${error?.message ?? "missing id"}`);
  }
  return data.id;
}

async function createWorkflow(admin, input) {
  const { data, error } = await admin.rpc("klyx_create_or_resume_workflow", {
    p_account_id: input.accountId,
    p_profile_id: input.profileId,
    p_conversation_id: input.conversationId,
    p_mode: input.mode,
    p_context: {
      complete_engine_certification: true,
      certification_run: input.runMarker,
      llm_is_authority: false,
    },
  });
  if (error) throw new Error(error.message);
  return rpcRow(data, `${input.mode} workflow create`);
}

async function transition(admin, input) {
  const { data, error } = await admin.rpc("klyx_transition_workflow", {
    p_workflow_id: input.workflow.workflow_id,
    p_account_id: input.accountId,
    p_expected_version: input.workflow.version,
    p_to_step: input.toStep,
    p_event_type: input.eventType,
    p_actor_type: "server",
    p_payload: {
      complete_engine_certification: true,
      certification_run: input.runMarker,
      llm_is_authority: false,
      semantic_step: input.semanticStep ?? input.toStep,
    },
  });
  if (error) throw new Error(error.message);
  const next = rpcRow(data, `${input.workflow.mode}:${input.toStep}`);
  invariant(
    Number(next.version) === Number(input.workflow.version) + 1,
    `${input.workflow.mode}:${input.toStep} did not advance workflow version exactly once.`
  );
  invariant(
    next.current_step === input.toStep,
    `${input.workflow.mode} expected ${input.toStep}, got ${next.current_step}.`
  );
  return next;
}

async function verifyEvents(admin, workflowId, expectedSteps, label) {
  const { data, error } = await admin
    .from("klyx_workflow_events")
    .select("event_type, actor_type, step, workflow_version, payload")
    .eq("workflow_id", workflowId)
    .order("workflow_version", { ascending: true });
  if (error) throw new Error(error.message);

  const events = data ?? [];
  const observedSteps = events
    .map((event) => event.step)
    .filter((step) => expectedSteps.includes(step));

  for (const step of expectedSteps) {
    invariant(observedSteps.includes(step), `${label} missing persisted step ${step}.`);
  }

  const certificationEvents = events.filter(
    (event) => event.payload?.complete_engine_certification === true
  );
  invariant(
    certificationEvents.length >= expectedSteps.length - 1,
    `${label} is missing certification transition events.`
  );
  invariant(
    certificationEvents.every((event) => event.actor_type === "server"),
    `${label} contains a non-server certification transition.`
  );
  invariant(
    certificationEvents.every((event) => event.payload?.llm_is_authority === false),
    `${label} contains a transition that treats the LLM as authority.`
  );

  return events.length;
}

async function main() {
  const { e2eOrigin, localSupabase } = assertGoldenPathIsolation();
  invariant(localSupabase, "Complete engine certification requires ephemeral local Supabase.");

  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
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
  if (signInError || !signInData.user) {
    throw new Error(`Certification authentication failed: ${signInError?.message ?? "missing user"}`);
  }

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (accountError || !account?.id) {
    throw new Error(`Canonical account missing: ${accountError?.message ?? "not found"}`);
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", signInData.user.id);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((profile) => profile.account_type === "client");
  const provider = (profiles ?? []).find((profile) => profile.account_type === "provider");
  invariant(client?.id, "Client profile missing for complete certification.");
  invariant(provider?.id, "Provider profile missing for complete certification.");

  const runMarker = `complete-engine-${randomUUID()}`;

  const requestConversationId = await createConversation(
    admin,
    client.id,
    `Complete engine DEMANDER ${runMarker}`
  );
  let requestWorkflow = await createWorkflow(admin, {
    accountId: account.id,
    profileId: client.id,
    conversationId: requestConversationId,
    mode: "request",
    runMarker,
  });
  invariant(requestWorkflow.current_step === "intention", "DEMANDER did not start at intention.");

  const requestTransitions = [
    ["comprehension", "intention_understood"],
    ["plan", "plan_built"],
    ["search", "search_started"],
    ["matching", "matching_completed"],
    ["quote", "quote_ready"],
    ["negotiation_confirmation", "confirmation_received"],
    ["booking", "booking_created"],
    ["payment", "payment_confirmed"],
    ["execution", "mission_started"],
    ["tracking", "tracking_active"],
    ["incident", "incident_opened"],
    ["refund_replacement", "refund_or_replacement_resolved"],
    ["closure", "mission_closed"],
  ];

  for (const [toStep, eventType] of requestTransitions) {
    requestWorkflow = await transition(admin, {
      accountId: account.id,
      workflow: requestWorkflow,
      toStep,
      eventType,
      runMarker,
    });
  }
  invariant(requestWorkflow.status === "completed", "DEMANDER did not close as completed.");

  const requestSteps = [
    "intention",
    "comprehension",
    "plan",
    "search",
    "matching",
    "quote",
    "negotiation_confirmation",
    "booking",
    "payment",
    "execution",
    "tracking",
    "incident",
    "refund_replacement",
    "closure",
  ];
  const requestEventCount = await verifyEvents(
    admin,
    requestWorkflow.workflow_id,
    requestSteps,
    "DEMANDER"
  );

  const earnConversationId = await createConversation(
    admin,
    provider.id,
    `Complete engine GAGNER ${runMarker}`
  );
  let earnWorkflow = await createWorkflow(admin, {
    accountId: account.id,
    profileId: provider.id,
    conversationId: earnConversationId,
    mode: "earn",
    runMarker,
  });
  invariant(earnWorkflow.current_step === "skill", "GAGNER did not start at skill.");

  const earnTransitions = [
    ["opportunities", "opportunities_discovered", "opportunity"],
    ["eligibility", "eligibility_checked", "eligibility"],
    ["proposal", "proposal_created", "proposal"],
    ["acceptance", "proposal_accepted", "acceptance"],
    ["mission", "mission_started", "mission"],
    ["settlement", "mission_completed", "completion"],
  ];

  for (const [toStep, eventType, semanticStep] of earnTransitions) {
    earnWorkflow = await transition(admin, {
      accountId: account.id,
      workflow: earnWorkflow,
      toStep,
      eventType,
      semanticStep,
      runMarker,
    });
  }

  const { data: completedSettlementData, error: completedSettlementError } =
    await admin.rpc("klyx_complete_settlement_workflow", {
      p_workflow_id: earnWorkflow.workflow_id,
      p_account_id: account.id,
      p_expected_version: earnWorkflow.version,
      p_event_type: "settlement_completed",
      p_actor_type: "server",
      p_payload: {
        complete_engine_certification: true,
        certification_run: runMarker,
        llm_is_authority: false,
        semantic_step: "settlement",
      },
    });
  if (completedSettlementError) throw new Error(completedSettlementError.message);
  earnWorkflow = rpcRow(completedSettlementData, "earn settlement completion");
  invariant(earnWorkflow.status === "completed", "GAGNER settlement did not complete workflow.");

  const earnSteps = [
    "skill",
    "opportunities",
    "eligibility",
    "proposal",
    "acceptance",
    "mission",
    "settlement",
  ];
  const earnEventCount = await verifyEvents(
    admin,
    earnWorkflow.workflow_id,
    earnSteps,
    "GAGNER"
  );

  const report = {
    certification: "KLYX_COMPLETE_ENGINE_RUNTIME",
    status: "PASS",
    runMarker,
    financialLiveUsed: false,
    llmSourceOfTruth: false,
    DEMANDER: {
      status: "PASS",
      workflowId: requestWorkflow.workflow_id,
      terminalStatus: requestWorkflow.status,
      steps: requestSteps,
      persistedEventCount: requestEventCount,
    },
    GAGNER: {
      status: "PASS",
      workflowId: earnWorkflow.workflow_id,
      terminalStatus: earnWorkflow.status,
      steps: [
        "skill",
        "opportunity",
        "eligibility",
        "proposal",
        "acceptance",
        "mission",
        "completion",
        "settlement",
      ],
      persistedEventCount: earnEventCount,
    },
  };

  fs.writeFileSync(
    RUNTIME_REPORT_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);

  await userClient.auth.signOut();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const failureReport = {
    certification: "KLYX_COMPLETE_ENGINE_RUNTIME",
    status: "FAIL",
    financialLiveUsed: false,
    llmSourceOfTruth: false,
    error: message,
  };
  try {
    fs.writeFileSync(
      RUNTIME_REPORT_PATH,
      `${JSON.stringify(failureReport, null, 2)}\n`,
      "utf8"
    );
  } catch (reportError) {
    console.error(
      `Unable to persist complete-engine failure report: ${
        reportError instanceof Error ? reportError.message : String(reportError)
      }`
    );
  }
  console.error(`KLYX complete workflow certification failed: ${message}`);
  process.exitCode = 1;
});

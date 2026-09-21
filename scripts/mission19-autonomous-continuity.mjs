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
  invariant(localSupabase, "Mission 19 continuity proof requires local Supabase.");

  const serviceRole = requiredGoldenPathEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = requiredGoldenPathEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );
  const email = requiredGoldenPathEnv("KLYX_E2E_EMAIL");
  const password = requiredGoldenPathEnv("KLYX_E2E_PASSWORD");

  const admin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userClient = createClient(e2eOrigin, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.user) {
    throw new Error(
      `Mission 19 fixture authentication failed: ${signInError?.message ?? "missing user"}`
    );
  }

  const userId = signInData.user.id;
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("owner_user_id", userId);
  if (profilesError) throw new Error(profilesError.message);

  const client = (profiles ?? []).find((p) => p.account_type === "client");
  const provider = (profiles ?? []).find((p) => p.account_type === "provider");
  invariant(client?.id, "Mission 19 client profile missing.");
  invariant(provider?.id, "Mission 19 provider profile missing.");

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", userId)
    .single();
  if (accountError || !account?.id) {
    throw new Error(
      `Mission 19 canonical account missing: ${accountError?.message ?? "not found"}`
    );
  }

  const runMarker = `mission19-${randomUUID()}`;

  // -----------------------------------------------------------------------
  // Browser close/reopen + model replacement: truth remains in Supabase.
  // -----------------------------------------------------------------------
  const { data: conversationA, error: conversationAError } = await admin
    .from("brain_conversations")
    .insert({
      user_id: client.id,
      title: "Mission 19 continuity model A",
    })
    .select("id")
    .single();
  if (conversationAError) throw new Error(conversationAError.message);

  const { data: createdData, error: createdError } = await admin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: account.id,
      p_profile_id: client.id,
      p_conversation_id: conversationA.id,
      p_mode: "request",
      p_context: {
        mission19_run: runMarker,
        planner_model: "model-a",
        browser_generation: 1,
      },
    }
  );
  if (createdError) throw new Error(createdError.message);
  const created = rpcRow(createdData, "workflow create");

  // "Close browser": discard the original client object and reconstruct truth
  // from a fresh server client using only persisted identifiers.
  const reopenedAdmin = createClient(e2eOrigin, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: reopened, error: reopenedError } = await reopenedAdmin
    .from("klyx_workflows")
    .select("id, current_step, version, context, conversation_id")
    .eq("id", created.workflow_id)
    .single();
  if (reopenedError) throw new Error(reopenedError.message);
  invariant(
    reopened.context?.mission19_run === runMarker,
    "Browser reopen lost canonical workflow context."
  );

  const { data: modelBData, error: modelBError } = await reopenedAdmin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: account.id,
      p_profile_id: client.id,
      p_conversation_id: conversationA.id,
      p_mode: "request",
      p_context: {
        planner_model: "model-b",
        browser_generation: 2,
        model_replaced: true,
      },
    }
  );
  if (modelBError) throw new Error(modelBError.message);
  const modelB = rpcRow(modelBData, "workflow model replacement");
  invariant(
    modelB.workflow_id === created.workflow_id,
    "LLM replacement created a second workflow."
  );

  const { data: modelContext, error: modelContextError } = await reopenedAdmin
    .from("klyx_workflows")
    .select("context")
    .eq("id", created.workflow_id)
    .single();
  if (modelContextError) throw new Error(modelContextError.message);
  invariant(
    modelContext.context?.mission19_run === runMarker &&
      modelContext.context?.planner_model === "model-b" &&
      modelContext.context?.model_replaced === true,
    "LLM replacement did not preserve/merge canonical workflow context."
  );

  // -----------------------------------------------------------------------
  // Conversation deletion: workflow survives, then atomically rebinds.
  // -----------------------------------------------------------------------
  const { error: deleteConversationError } = await reopenedAdmin
    .from("brain_conversations")
    .delete()
    .eq("id", conversationA.id);
  if (deleteConversationError) throw new Error(deleteConversationError.message);

  const { data: orphaned, error: orphanedError } = await reopenedAdmin
    .from("klyx_workflows")
    .select("id, conversation_id, version")
    .eq("id", created.workflow_id)
    .single();
  if (orphanedError) throw new Error(orphanedError.message);
  invariant(
    orphaned.conversation_id === null,
    "Deleting conversation deleted or retained stale workflow binding."
  );

  const { data: conversationB, error: conversationBError } = await reopenedAdmin
    .from("brain_conversations")
    .insert({
      user_id: client.id,
      title: "Mission 19 continuity resumed",
    })
    .select("id")
    .single();
  if (conversationBError) throw new Error(conversationBError.message);

  const { data: reboundData, error: reboundError } = await reopenedAdmin.rpc(
    "klyx_resume_orphaned_workflow",
    {
      p_account_id: account.id,
      p_profile_id: client.id,
      p_conversation_id: conversationB.id,
      p_mode: "request",
    }
  );
  if (reboundError) throw new Error(reboundError.message);
  const rebound = rpcRow(reboundData, "workflow conversation rebound");
  invariant(
    rebound.workflow_id === created.workflow_id,
    "Conversation recovery rebound the wrong workflow."
  );
  invariant(
    Number(rebound.version) === Number(orphaned.version) + 1,
    "Conversation recovery did not advance workflow version."
  );

  const { data: reboundEvents, error: reboundEventsError } = await reopenedAdmin
    .from("klyx_workflow_events")
    .select("event_type, workflow_version, payload")
    .eq("workflow_id", created.workflow_id)
    .eq("event_type", "workflow_conversation_rebound");
  if (reboundEventsError) throw new Error(reboundEventsError.message);
  invariant(
    (reboundEvents ?? []).length === 1 &&
      reboundEvents[0].payload?.conversation_id === conversationB.id,
    "Conversation recovery audit event missing or duplicated."
  );

  // The original create/resume RPC must still merge context after rebind.
  const { error: postRebindMergeError } = await reopenedAdmin.rpc(
    "klyx_create_or_resume_workflow",
    {
      p_account_id: account.id,
      p_profile_id: client.id,
      p_conversation_id: conversationB.id,
      p_mode: "request",
      p_context: { resumed_after_conversation_delete: true },
    }
  );
  if (postRebindMergeError) throw new Error(postRebindMergeError.message);

  const { data: postRebindContext, error: postRebindContextError } =
    await reopenedAdmin
      .from("klyx_workflows")
      .select("context")
      .eq("id", created.workflow_id)
      .single();
  if (postRebindContextError) throw new Error(postRebindContextError.message);
  invariant(
    postRebindContext.context?.mission19_run === runMarker &&
      postRebindContext.context?.resumed_after_conversation_delete === true,
    "Conversation recovery bypassed canonical context merge."
  );

  // -----------------------------------------------------------------------
  // Double-click/action replay: one persistent action identity.
  // -----------------------------------------------------------------------
  const actionKey = `mission19-action-${randomUUID()}`;
  const actionRecord = {
    workflow_id: created.workflow_id,
    account_id: account.id,
    action_type: "confirm_booking",
    mutation_class: "sensitive",
    requires_confirmation: true,
    proposed_by: "assistant",
    executor: "server",
    status: "awaiting_confirmation",
    idempotency_key: actionKey,
    input: { mission19_run: runMarker },
    authorization_context: {},
    result: {},
  };

  const { data: action, error: actionError } = await reopenedAdmin
    .from("klyx_workflow_actions")
    .insert(actionRecord)
    .select("id")
    .single();
  if (actionError) throw new Error(actionError.message);

  const { error: replayError } = await reopenedAdmin
    .from("klyx_workflow_actions")
    .insert(actionRecord);
  invariant(
    replayError?.code === "23505",
    `Action replay was not fenced by durable idempotency (code=${replayError?.code ?? "none"}).`
  );

  const { count: actionCount, error: actionCountError } = await reopenedAdmin
    .from("klyx_workflow_actions")
    .select("id", { count: "exact", head: true })
    .eq("workflow_id", created.workflow_id)
    .eq("idempotency_key", actionKey);
  if (actionCountError) throw new Error(actionCountError.message);
  invariant(actionCount === 1, "Double-click created duplicate workflow actions.");

  // -----------------------------------------------------------------------
  // Worker crash/retry: same durable job, fenced lease, next attempt recovers.
  // -----------------------------------------------------------------------
  const jobKey = `mission19-job-${randomUUID()}`;
  const enqueueArgs = {
    p_job_type: "mission19_continuity_probe",
    p_idempotency_key: jobKey,
    p_payload: { workflow_id: created.workflow_id, mission19_run: runMarker },
    p_account_id: account.id,
    p_domain_type: "orchestrator",
    p_domain_resource_type: "workflow",
    p_domain_resource_id: created.workflow_id,
    p_failure_domain_type: "workflow",
    p_failure_domain_key: created.workflow_id,
    p_priority: 10,
    p_max_attempts: 3,
    p_backoff_base_seconds: 1,
    p_backoff_max_seconds: 1,
  };

  const { data: enqueue1Data, error: enqueue1Error } = await reopenedAdmin.rpc(
    "klyx_enqueue_durable_job",
    enqueueArgs
  );
  if (enqueue1Error) throw new Error(enqueue1Error.message);
  const enqueue1 = rpcRow(enqueue1Data, "durable job enqueue #1");

  const { data: enqueue2Data, error: enqueue2Error } = await reopenedAdmin.rpc(
    "klyx_enqueue_durable_job",
    enqueueArgs
  );
  if (enqueue2Error) throw new Error(enqueue2Error.message);
  const enqueue2 = rpcRow(enqueue2Data, "durable job enqueue #2");

  invariant(enqueue1.created === true, "Initial durable job was not created.");
  invariant(enqueue2.created === false, "Replay created a second durable job.");
  invariant(
    enqueue2.job_id === enqueue1.job_id,
    "Durable job replay changed operation identity."
  );

  const { data: claimAData, error: claimAError } = await reopenedAdmin.rpc(
    "klyx_claim_durable_jobs",
    {
      p_worker_id: "mission19-worker-a",
      p_job_types: ["mission19_continuity_probe"],
      p_limit: 1,
      p_lease_seconds: 15,
    }
  );
  if (claimAError) throw new Error(claimAError.message);
  const claimA = rpcRow(claimAData, "durable job first claim");
  invariant(claimA.job_id === enqueue1.job_id, "Worker A claimed wrong job.");

  // Test harness only: simulate process death by expiring the lease in local DB.
  const { error: expireLeaseError } = await reopenedAdmin
    .from("ops_durable_jobs")
    .update({ lease_expires_at: new Date(Date.now() - 5_000).toISOString() })
    .eq("id", enqueue1.job_id);
  if (expireLeaseError) throw new Error(expireLeaseError.message);

  const { data: reapedCount, error: reapError } = await reopenedAdmin.rpc(
    "klyx_reap_expired_durable_jobs",
    { p_limit: 10 }
  );
  if (reapError) throw new Error(reapError.message);
  invariant(Number(reapedCount) >= 1, "Expired worker lease was not reaped.");

  const { error: makeRetryReadyError } = await reopenedAdmin
    .from("ops_durable_jobs")
    .update({ available_at: new Date(Date.now() - 1_000).toISOString() })
    .eq("id", enqueue1.job_id)
    .eq("status", "retry_wait");
  if (makeRetryReadyError) throw new Error(makeRetryReadyError.message);

  const { data: claimBData, error: claimBError } = await reopenedAdmin.rpc(
    "klyx_claim_durable_jobs",
    {
      p_worker_id: "mission19-worker-b",
      p_job_types: ["mission19_continuity_probe"],
      p_limit: 1,
      p_lease_seconds: 15,
    }
  );
  if (claimBError) throw new Error(claimBError.message);
  const claimB = rpcRow(claimBData, "durable job recovery claim");
  invariant(claimB.job_id === enqueue1.job_id, "Retry claimed a different job.");
  invariant(Number(claimB.attempt_no) === 2, "Worker crash did not advance retry attempt.");
  invariant(
    claimB.lease_token !== claimA.lease_token,
    "Worker crash recovery reused stale lease token."
  );

  const completeArgs = {
    p_job_id: claimB.job_id,
    p_lease_token: claimB.lease_token,
    p_worker_id: "mission19-worker-b",
    p_result_ref: `workflow:${created.workflow_id}`,
  };
  const { data: complete1Data, error: complete1Error } = await reopenedAdmin.rpc(
    "klyx_complete_durable_job",
    completeArgs
  );
  if (complete1Error) throw new Error(complete1Error.message);
  const complete1 = rpcRow(complete1Data, "durable job completion");

  const { data: complete2Data, error: complete2Error } = await reopenedAdmin.rpc(
    "klyx_complete_durable_job",
    completeArgs
  );
  if (complete2Error) throw new Error(complete2Error.message);
  const complete2 = rpcRow(complete2Data, "durable job replayed completion");
  invariant(
    complete1.job_status === "succeeded" &&
      complete2.job_status === "succeeded" &&
      Number(complete2.attempt_count) === 2,
    "Durable job completion replay was not idempotent."
  );

  // -----------------------------------------------------------------------
  // Price drift: mutable catalog price cannot rewrite booking economics.
  // golden-path-client-lifecycle.mjs creates the accepted unpaid booking first.
  // -----------------------------------------------------------------------
  const { data: booking, error: bookingError } = await reopenedAdmin
    .from("bookings")
    .select(
      "id, user_service_id, parent_id, provider_id, status, payment_status, currency, subtotal_amount_minor, estimated_amount_cents, amount_total, total_amount_minor, provider_amount_minor"
    )
    .eq("parent_id", client.id)
    .eq("provider_id", provider.id)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (bookingError) throw new Error(bookingError.message);
  invariant(booking.user_service_id, "Booking user_service_id missing.");

  const bookingEconomicsBefore = JSON.stringify({
    currency: booking.currency,
    subtotal_amount_minor: booking.subtotal_amount_minor,
    estimated_amount_cents: booking.estimated_amount_cents,
    amount_total: booking.amount_total,
    total_amount_minor: booking.total_amount_minor,
    provider_amount_minor: booking.provider_amount_minor,
  });
  invariant(
    booking.subtotal_amount_minor != null ||
      booking.estimated_amount_cents != null ||
      booking.amount_total != null,
    "Booking has no persisted monetary snapshot to protect from price drift."
  );

  const { data: serviceProfile, error: serviceProfileError } =
    await reopenedAdmin
      .from("service_profiles")
      .select("id, price, pricing_type")
      .eq("user_service_id", booking.user_service_id)
      .single();
  if (serviceProfileError) throw new Error(serviceProfileError.message);

  const originalPrice = Number(serviceProfile.price);
  invariant(Number.isFinite(originalPrice), "Service profile price is invalid.");
  const mutatedPrice = originalPrice + 11;

  const { error: mutatePriceError } = await reopenedAdmin
    .from("service_profiles")
    .update({ price: mutatedPrice })
    .eq("id", serviceProfile.id);
  if (mutatePriceError) throw new Error(mutatePriceError.message);

  try {
    const { data: bookingAfterPriceChange, error: bookingAfterPriceChangeError } =
      await reopenedAdmin
        .from("bookings")
        .select(
          "currency, subtotal_amount_minor, estimated_amount_cents, amount_total, total_amount_minor, provider_amount_minor"
        )
        .eq("id", booking.id)
        .single();
    if (bookingAfterPriceChangeError) {
      throw new Error(bookingAfterPriceChangeError.message);
    }

    invariant(
      JSON.stringify(bookingAfterPriceChange) === bookingEconomicsBefore,
      "Catalog price drift rewrote persisted booking economics."
    );
  } finally {
    const { error: restorePriceError } = await reopenedAdmin
      .from("service_profiles")
      .update({ price: originalPrice })
      .eq("id", serviceProfile.id);
    if (restorePriceError) throw new Error(restorePriceError.message);
  }

  process.stdout.write(
    `${JSON.stringify({
      certified: true,
      workflowId: created.workflow_id,
      actionId: action.id,
      durableJobId: enqueue1.job_id,
      bookingId: booking.id,
      scenarios: {
        browser_resume: true,
        llm_replacement: true,
        conversation_deleted_and_rebound: true,
        double_click_and_action_replay: true,
        worker_crash_retry_and_ack_replay: true,
        price_drift_snapshot_preserved: true,
      },
    })}\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`KLYX Mission 19 continuity proof failed: ${message}`);
  process.exitCode = 1;
});

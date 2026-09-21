import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SCENARIOS = [
  "happy_path",
  "partial_refund",
  "full_refund",
  "reversal",
  "failed_payment",
  "failed_transfer",
  "late_webhook",
  "duplicate_webhook",
  "timeout",
  "recovery",
];

const TOPOLOGIES = [
  "single",
  "group",
  "split",
  "multi_provider",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/;

function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error("Missing required environment: " + name);
  return value;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function safeUrl(value) {
  const url = new URL(value);
  assert(url.protocol === "https:", "KLYX_CERT_PRODUCTION_URL_HTTPS_REQUIRED");
  assert(
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname),
    "KLYX_CERT_PRODUCTION_URL_PUBLIC_REQUIRED"
  );
  return url;
}

function movementTotal(rows, type) {
  return rows
    .filter((row) => row.movement_type === type)
    .reduce((sum, row) => sum + Number(row.amount_minor ?? 0), 0);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function allBookingIdsCovered(rows, bookingIds) {
  const covered = new Set();
  for (const row of rows) {
    const ids = Array.isArray(row.booking_ids) ? row.booking_ids : [];
    for (const id of ids) covered.add(String(id));
  }
  return bookingIds.every((id) => covered.has(id));
}

async function queryOrThrow(query, code) {
  const { data, error } = await query;
  if (error) {
    throw new Error(code + ":" + (error.code ?? "query_failed"));
  }
  return data ?? [];
}

async function loadEvidence(supabase, bookingIds) {
  const bookings = await queryOrThrow(
    supabase
      .from("bookings")
      .select(
        "id,parent_id,provider_id,babysitter_id,booking_group_id,payment_status,payment_mode,payment_failure_code,payment_failed_at,refund_status,stripe_checkout_session_id,stripe_payment_intent_id,stripe_refund_id,currency,tax_amount_minor"
      )
      .in("id", bookingIds),
    "KLYX_CERT_BOOKINGS_READ_FAILED"
  );

  assert(
    bookings.length === bookingIds.length,
    "KLYX_CERT_BOOKING_SET_INCOMPLETE"
  );

  const ledger = await queryOrThrow(
    supabase
      .from("financial_ledger_current")
      .select(
        "id,booking_id,movement_type,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,stripe_transfer_reversal_id,stripe_refund_id,new_state,cause,occurred_at"
      )
      .in("booking_id", bookingIds),
    "KLYX_CERT_LEDGER_READ_FAILED"
  );

  const settlements = await queryOrThrow(
    supabase
      .from("booking_settlements")
      .select(
        "booking_id,payment_mode,currency,gross_amount_cents,platform_fee_cents,provider_amount_cents,state,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,stripe_transfer_reversal_id,last_error_code,last_reconciled_at"
      )
      .in("booking_id", bookingIds),
    "KLYX_CERT_SETTLEMENT_READ_FAILED"
  );

  const settlementEvents = await queryOrThrow(
    supabase
      .from("booking_settlement_reconciliation_events")
      .select(
        "booking_id,source,action,outcome,reason_code,stripe_transfer_id,stripe_transfer_reversal_id,created_at"
      )
      .in("booking_id", bookingIds),
    "KLYX_CERT_SETTLEMENT_EVENTS_READ_FAILED"
  );

  const reconciliation = await queryOrThrow(
    supabase
      .from("financial_reconciliation_current")
      .select("booking_id,state,dimension,reason_code")
      .in("booking_id", bookingIds),
    "KLYX_CERT_RECONCILIATION_READ_FAILED"
  );

  const splitItems = await queryOrThrow(
    supabase
      .from("split_booking_batch_items")
      .select("batch_id,booking_id,provider_profile_id")
      .in("booking_id", bookingIds),
    "KLYX_CERT_SPLIT_ITEMS_READ_FAILED"
  );

  const splitBatchIds = unique(splitItems.map((row) => row.batch_id));
  const splitBatches = splitBatchIds.length
    ? await queryOrThrow(
        supabase
          .from("split_booking_batches")
          .select("id,provider_count,status")
          .in("id", splitBatchIds),
        "KLYX_CERT_SPLIT_BATCH_READ_FAILED"
      )
    : [];

  const groupIds = unique(bookings.map((row) => row.booking_group_id));
  const bookingGroups = groupIds.length
    ? await queryOrThrow(
        supabase
          .from("booking_groups")
          .select(
            "id,client_profile_id,provider_profile_id,payment_status,payment_mode,total_amount_cents,refund_status,refunded_amount_cents"
          )
          .in("id", groupIds),
        "KLYX_CERT_BOOKING_GROUP_READ_FAILED"
      )
    : [];

  const groupMembers = await queryOrThrow(
    supabase
      .from("platform_held_group_settlement_members")
      .select(
        "id,group_settlement_id,batch_id,provider_profile_id,provider_account_id,booking_ids,currency,gross_amount_cents,platform_fee_cents,provider_amount_cents,state,stripe_transfer_id,reversed_amount_cents,refunded_gross_amount_cents,refunded_provider_amount_cents,last_error_code"
      )
      .overlaps("booking_ids", bookingIds),
    "KLYX_CERT_GROUP_MEMBERS_READ_FAILED"
  );

  const groupSettlementIds = unique(
    groupMembers.map((row) => row.group_settlement_id)
  );
  const groupParents = groupSettlementIds.length
    ? await queryOrThrow(
        supabase
          .from("platform_held_group_settlements")
          .select(
            "id,batch_id,client_profile_id,currency,gross_amount_cents,platform_fee_cents,provider_amount_cents,state,stripe_payment_intent_id,stripe_charge_id,refunded_amount_cents"
          )
          .in("id", groupSettlementIds),
        "KLYX_CERT_GROUP_PARENT_READ_FAILED"
      )
    : [];

  const objectIds = unique([
    ...bookings.flatMap((row) => [
      row.stripe_checkout_session_id,
      row.stripe_payment_intent_id,
      row.stripe_refund_id,
    ]),
    ...ledger.flatMap((row) => [
      row.stripe_checkout_session_id,
      row.stripe_payment_intent_id,
      row.stripe_charge_id,
      row.stripe_transfer_id,
      row.stripe_transfer_reversal_id,
      row.stripe_refund_id,
    ]),
    ...settlements.flatMap((row) => [
      row.stripe_payment_intent_id,
      row.stripe_charge_id,
      row.stripe_transfer_id,
      row.stripe_transfer_reversal_id,
    ]),
    ...groupMembers.flatMap((row) => [row.stripe_transfer_id]),
    ...groupParents.flatMap((row) => [
      row.stripe_payment_intent_id,
      row.stripe_charge_id,
    ]),
  ]);

  const webhooks = objectIds.length
    ? await queryOrThrow(
        supabase
          .from("stripe_webhook_events")
          .select(
            "stripe_event_id,event_type,object_id,livemode,status,attempt_count,delivery_count,received_at,last_received_at"
          )
          .in("object_id", objectIds)
          .eq("livemode", true),
        "KLYX_CERT_WEBHOOK_READ_FAILED"
      )
    : [];

  return {
    bookings,
    ledger,
    settlements,
    settlementEvents,
    reconciliation,
    splitItems,
    splitBatches,
    bookingGroups,
    groupMembers,
    groupParents,
    webhooks,
  };
}

function validateTopology(cell, evidence) {
  const bookingIds = cell.bookingIds;
  const providers = unique(
    evidence.bookings.map(
      (row) => row.provider_id ?? row.babysitter_id
    )
  );

  if (cell.topology === "single") {
    assert(bookingIds.length === 1, "KLYX_CERT_SINGLE_BOOKING_COUNT");
    assert(
      evidence.bookings[0].booking_group_id == null,
      "KLYX_CERT_SINGLE_GROUP_LINK_PRESENT"
    );
    assert(
      evidence.splitItems.length === 0,
      "KLYX_CERT_SINGLE_SPLIT_LINK_PRESENT"
    );
    assert(
      evidence.groupMembers.length === 0,
      "KLYX_CERT_SINGLE_MULTI_EXECUTOR_LINK_PRESENT"
    );
    return;
  }

  if (cell.topology === "group") {
    assert(bookingIds.length >= 2, "KLYX_CERT_GROUP_BOOKING_COUNT");
    const groupIds = unique(
      evidence.bookings.map((row) => row.booking_group_id)
    );
    assert(groupIds.length === 1, "KLYX_CERT_GROUP_AUTHORITY_MISSING");
    assert(
      evidence.bookingGroups.length === 1,
      "KLYX_CERT_GROUP_ROW_MISSING"
    );
    assert(providers.length === 1, "KLYX_CERT_GROUP_PROVIDER_COUNT");
    assert(
      evidence.splitItems.length === 0,
      "KLYX_CERT_GROUP_SPLIT_AUTHORITY_PRESENT"
    );
    return;
  }

  if (cell.topology === "split") {
    assert(
      evidence.splitItems.length >= bookingIds.length,
      "KLYX_CERT_SPLIT_ITEMS_MISSING"
    );
    assert(
      evidence.splitBatches.length === 1,
      "KLYX_CERT_SPLIT_BATCH_MISSING"
    );
    const itemIds = new Set(
      evidence.splitItems.map((row) => String(row.booking_id))
    );
    assert(
      bookingIds.every((id) => itemIds.has(id)),
      "KLYX_CERT_SPLIT_BOOKING_COVERAGE"
    );
    return;
  }

  assert(
    evidence.groupParents.length === 1,
    "KLYX_CERT_MULTI_PROVIDER_PARENT_MISSING"
  );
  assert(
    allBookingIdsCovered(evidence.groupMembers, bookingIds),
    "KLYX_CERT_MULTI_PROVIDER_BOOKING_COVERAGE"
  );
  const providerAccounts = unique(
    evidence.groupMembers.map((row) => row.provider_account_id)
  );
  assert(
    providerAccounts.length >= 2,
    "KLYX_CERT_MULTI_PROVIDER_COUNT"
  );
}

function hasReleasedSettlement(evidence) {
  return (
    evidence.settlements.some(
      (row) => row.state === "released" && row.stripe_transfer_id
    ) ||
    evidence.groupMembers.some(
      (row) => row.state === "released" && row.stripe_transfer_id
    )
  );
}

function hasFailedSettlement(evidence) {
  return (
    evidence.settlements.some(
      (row) =>
        ["release_failed", "review_required", "human_review"].includes(
          row.state
        ) && Boolean(row.last_error_code)
    ) ||
    evidence.groupMembers.some(
      (row) =>
        ["release_failed", "review_required", "human_review"].includes(
          row.state
        ) && Boolean(row.last_error_code)
    )
  );
}

function validateScenario(cell, evidence) {
  const charge = movementTotal(evidence.ledger, "charge");
  const commission = movementTotal(evidence.ledger, "commission");
  const liability = movementTotal(
    evidence.ledger,
    "provider_liability"
  );
  const transfer = movementTotal(evidence.ledger, "transfer");
  const reversal = movementTotal(evidence.ledger, "reversal");
  const refund = movementTotal(evidence.ledger, "refund");

  const currencies = unique(evidence.ledger.map((row) => row.currency));
  if (cell.scenario !== "failed_payment") {
    assert(currencies.length === 1, "KLYX_CERT_LEDGER_CURRENCY_AMBIGUOUS");
  }

  if (cell.scenario === "happy_path") {
    assert(charge > 0, "KLYX_CERT_HAPPY_CHARGE_MISSING");
    assert(commission >= 0, "KLYX_CERT_HAPPY_COMMISSION_INVALID");
    assert(liability > 0, "KLYX_CERT_HAPPY_LIABILITY_MISSING");
    assert(transfer > 0, "KLYX_CERT_HAPPY_TRANSFER_MISSING");
    assert(
      charge === commission + liability,
      "KLYX_CERT_HAPPY_ACCOUNTING_IDENTITY"
    );
    assert(
      liability === transfer,
      "KLYX_CERT_HAPPY_PROVIDER_TRANSFER_IDENTITY"
    );
    assert(refund === 0 && reversal === 0, "KLYX_CERT_HAPPY_TERMINAL_DRIFT");
    assert(hasReleasedSettlement(evidence), "KLYX_CERT_HAPPY_SETTLEMENT");
    return;
  }

  if (cell.scenario === "partial_refund") {
    assert(charge > 0, "KLYX_CERT_PARTIAL_CHARGE_MISSING");
    assert(
      refund > 0 && refund < charge,
      "KLYX_CERT_PARTIAL_REFUND_AMOUNT"
    );
    if (transfer > 0) {
      assert(
        reversal > 0 && reversal <= transfer,
        "KLYX_CERT_PARTIAL_REVERSAL_MISSING"
      );
    }
    return;
  }

  if (cell.scenario === "full_refund") {
    assert(charge > 0, "KLYX_CERT_FULL_CHARGE_MISSING");
    assert(refund === charge, "KLYX_CERT_FULL_REFUND_IDENTITY");
    if (transfer > 0) {
      assert(
        reversal === transfer,
        "KLYX_CERT_FULL_REVERSAL_IDENTITY"
      );
    }
    return;
  }

  if (cell.scenario === "reversal") {
    assert(transfer > 0, "KLYX_CERT_REVERSAL_TRANSFER_MISSING");
    assert(
      reversal > 0 && reversal <= transfer,
      "KLYX_CERT_REVERSAL_AMOUNT"
    );
    assert(
      evidence.ledger.some(
        (row) =>
          row.movement_type === "reversal" &&
          Boolean(row.stripe_transfer_reversal_id)
      ) ||
        evidence.settlements.some(
          (row) => Boolean(row.stripe_transfer_reversal_id)
        ),
      "KLYX_CERT_REVERSAL_STRIPE_ID_MISSING"
    );
    return;
  }

  if (cell.scenario === "failed_payment") {
    assert(
      evidence.bookings.every(
        (row) =>
          row.payment_status === "failed" &&
          Boolean(row.payment_failed_at || row.payment_failure_code)
      ),
      "KLYX_CERT_FAILED_PAYMENT_BOOKING_STATE"
    );
    assert(
      charge === 0 && transfer === 0,
      "KLYX_CERT_FAILED_PAYMENT_MONEY_MOVED"
    );
    assert(
      evidence.webhooks.some(
        (row) =>
          row.event_type === "payment_intent.payment_failed" &&
          row.status === "processed"
      ),
      "KLYX_CERT_FAILED_PAYMENT_LIVE_WEBHOOK_MISSING"
    );
    return;
  }

  if (cell.scenario === "failed_transfer") {
    assert(charge > 0, "KLYX_CERT_FAILED_TRANSFER_CHARGE_MISSING");
    assert(liability > 0, "KLYX_CERT_FAILED_TRANSFER_LIABILITY_MISSING");
    assert(transfer === 0, "KLYX_CERT_FAILED_TRANSFER_FALSE_TRANSFER");
    assert(
      hasFailedSettlement(evidence),
      "KLYX_CERT_FAILED_TRANSFER_STATE_MISSING"
    );
    return;
  }

  if (cell.scenario === "late_webhook") {
    assert(
      evidence.settlementEvents.some((row) =>
        [
          "recover_missing_payment_webhook",
          "recover_missing_refund_webhook",
        ].includes(row.action)
      ),
      "KLYX_CERT_LATE_WEBHOOK_RECOVERY_EVENT_MISSING"
    );
    return;
  }

  if (cell.scenario === "duplicate_webhook") {
    assert(
      evidence.webhooks.some(
        (row) =>
          row.status === "processed" &&
          Number(row.delivery_count ?? 1) >= 2
      ),
      "KLYX_CERT_DUPLICATE_WEBHOOK_DELIVERY_MISSING"
    );
    return;
  }

  if (cell.scenario === "timeout") {
    const timeoutInSettlement = [
      ...evidence.settlements,
      ...evidence.groupMembers,
    ].some((row) =>
      String(row.last_error_code ?? "")
        .toLowerCase()
        .includes("timeout")
    );
    const timeoutInAudit = evidence.settlementEvents.some((row) =>
      [
        row.reason_code,
        row.action,
        row.outcome,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes("timeout"))
    );
    assert(
      timeoutInSettlement || timeoutInAudit,
      "KLYX_CERT_TIMEOUT_EVIDENCE_MISSING"
    );
    return;
  }

  assert(
    evidence.settlementEvents.some(
      (row) =>
        row.outcome === "recovered" ||
        [
          "recover_missing_payment_webhook",
          "recover_missing_refund_webhook",
          "transfer_db_reconciled",
          "release_after_truth_search",
          "refund_terminal_reconciled",
        ].includes(row.action)
    ),
    "KLYX_CERT_RECOVERY_EVENT_MISSING"
  );
}

async function reconcileBooking(productionUrl, secret, bookingId) {
  const response = await fetch(
    new URL("/api/ops/financial-reconciliation", productionUrl),
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + secret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ bookingId }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  assert(response.ok, "KLYX_CERT_RECONCILIATION_HTTP_" + response.status);
  const body = await response.json();
  assert(body?.result?.status === "coherent", "KLYX_CERT_RECONCILIATION_NOT_COHERENT");
}

async function main() {
  const expectedSha = requiredEnv("KLYX_EXPECTED_SHA").toLowerCase();
  assert(SHA_RE.test(expectedSha), "KLYX_CERT_EXPECTED_SHA_INVALID");

  const manifestPath = requiredEnv("KLYX_FINANCIAL_CERT_MANIFEST_PATH");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert(manifest?.version === 1, "KLYX_CERT_MANIFEST_VERSION");
  assert(
    String(manifest?.certificationSha ?? "").toLowerCase() === expectedSha,
    "KLYX_CERT_MANIFEST_SHA_MISMATCH"
  );
  assert(Array.isArray(manifest?.cells), "KLYX_CERT_MANIFEST_CELLS_REQUIRED");
  assert(manifest.cells.length === 40, "KLYX_CERT_MATRIX_MUST_HAVE_40_CELLS");

  const expectedKeys = new Set(
    SCENARIOS.flatMap((scenario) =>
      TOPOLOGIES.map((topology) => scenario + ":" + topology)
    )
  );
  const seenKeys = new Set();
  const usedBookingIds = new Set();

  for (const cell of manifest.cells) {
    const scenario = String(cell?.scenario ?? "");
    const topology = String(cell?.topology ?? "");
    const key = scenario + ":" + topology;

    assert(expectedKeys.has(key), "KLYX_CERT_MATRIX_CELL_UNKNOWN:" + key);
    assert(!seenKeys.has(key), "KLYX_CERT_MATRIX_CELL_DUPLICATE:" + key);
    seenKeys.add(key);

    assert(
      Array.isArray(cell.bookingIds) && cell.bookingIds.length > 0,
      "KLYX_CERT_BOOKING_IDS_REQUIRED:" + key
    );
    assert(cell.bookingIds.length <= 20, "KLYX_CERT_BOOKING_IDS_EXCESSIVE:" + key);

    for (const rawId of cell.bookingIds) {
      const id = String(rawId);
      assert(UUID_RE.test(id), "KLYX_CERT_BOOKING_ID_INVALID:" + key);
      assert(
        !usedBookingIds.has(id),
        "KLYX_CERT_BOOKING_REUSED_ACROSS_CELLS:" + key
      );
      usedBookingIds.add(id);
    }
  }

  assert(
    seenKeys.size === expectedKeys.size &&
      [...expectedKeys].every((key) => seenKeys.has(key)),
    "KLYX_CERT_MATRIX_INCOMPLETE"
  );

  const productionUrl = safeUrl(requiredEnv("KLYX_PRODUCTION_URL"));
  const healthResponse = await fetch(
    new URL("/api/health/build", productionUrl),
    { signal: AbortSignal.timeout(15_000), cache: "no-store" }
  );
  assert(healthResponse.ok, "KLYX_CERT_BUILD_HEALTH_UNAVAILABLE");
  const health = await healthResponse.json();

  assert(
    String(health?.commitSha ?? "").toLowerCase() === expectedSha,
    "KLYX_CERT_DEPLOYED_SHA_MISMATCH"
  );
  assert(
    health?.environment === "production",
    "KLYX_CERT_DEPLOYMENT_NOT_PRODUCTION"
  );
  assert(
    health?.financialRuntime?.stripeMode === "live",
    "KLYX_CERT_RUNTIME_NOT_LIVE"
  );
  assert(
    health?.financialRuntime?.livePaymentsEnabled === false,
    "KLYX_CERT_GENERAL_LIVE_MUST_REMAIN_OFF"
  );
  assert(
    health?.financialRuntime?.liveCertificationEnabled === true,
    "KLYX_CERT_CONTROLLED_LIVE_NOT_ENABLED"
  );
  assert(
    health?.financialRuntime?.liveCertificationSha === expectedSha &&
      health?.financialRuntime?.drCertifiedSha === expectedSha,
    "KLYX_CERT_RUNTIME_SHA_CHAIN_MISMATCH"
  );
  assert(
    health?.financialRuntime?.certificationProfileConfigured === true,
    "KLYX_CERT_PROFILE_NOT_CONFIGURED"
  );

  const stripeSecret = requiredEnv("STRIPE_SECRET_KEY");
  assert(
    stripeSecret.startsWith("sk_live_"),
    "KLYX_CERT_STRIPE_LIVE_SECRET_REQUIRED"
  );

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const reconciliationSecret = requiredEnv(
    "KLYX_FINANCIAL_RECONCILIATION_SECRET"
  );
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = [];

  for (const cell of manifest.cells) {
    const key = cell.scenario + ":" + cell.topology;
    const evidence = await loadEvidence(supabase, cell.bookingIds);

    validateTopology(cell, evidence);
    validateScenario(cell, evidence);

    const unresolvedBefore = evidence.reconciliation.filter((row) =>
      ["reconciliation", "human_review"].includes(row.state)
    );
    assert(
      unresolvedBefore.length === 0,
      "KLYX_CERT_OPEN_RECONCILIATION_BEFORE:" + key
    );

    for (const bookingId of cell.bookingIds) {
      await reconcileBooking(
        productionUrl,
        reconciliationSecret,
        bookingId
      );
    }

    const unresolvedAfter = await queryOrThrow(
      supabase
        .from("financial_reconciliation_current")
        .select("booking_id,state")
        .in("booking_id", cell.bookingIds)
        .in("state", ["reconciliation", "human_review"]),
      "KLYX_CERT_RECONCILIATION_VERIFY_FAILED"
    );
    assert(
      unresolvedAfter.length === 0,
      "KLYX_CERT_OPEN_RECONCILIATION_AFTER:" + key
    );

    summary.push({
      scenario: cell.scenario,
      topology: cell.topology,
      bookingCount: cell.bookingIds.length,
      coherent: true,
    });
  }

  const proof = {
    version: 1,
    certificationSha: expectedSha,
    overall: "certified",
    matrixCells: summary.length,
    generatedAt: new Date().toISOString(),
    cells: summary,
    invariants: {
      exactSha: true,
      controlledLiveOnly: true,
      canonicalLedger: true,
      settlementTruth: true,
      stripeTruthReconciled: true,
      silentCorrection: false,
    },
  };

  const proofPath =
    process.env.KLYX_FINANCIAL_CERT_PROOF_PATH?.trim() ||
    "klyx-production-financial-certification.json";
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n", "utf8");

  process.stdout.write(
    "KLYX production financial certification: 40/40 coherent cells on " +
      expectedSha +
      "\n"
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "KLYX_CERT_UNKNOWN_FAILURE";
  process.stderr.write("KLYX production financial certification FAILED: " + message + "\n");
  process.exit(1);
});

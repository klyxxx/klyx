import { createHash } from "node:crypto";
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

const TOPOLOGIES = ["single", "group", "split", "multi_provider"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{40}$/;
const ALLOWED_AUTHORITIES = new Set([
  "ledger",
  "settlement_audit",
  "webhook",
  "ops_event",
  "durable_job",
]);

function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`Missing required environment: ${name}`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function decodeManifest() {
  const encoded = requiredEnv("KLYX_PRODUCTION_FINANCIAL_MANIFEST_BASE64");
  const bytes = Buffer.from(encoded, "base64");
  assert(bytes.length > 0, "Certification manifest is empty.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const parsed = JSON.parse(bytes.toString("utf8"));
  return { parsed, hash };
}

async function getOne(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? null;
}

async function getMany(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

function movementRows(rows, type) {
  return rows.filter((row) => row.movement_type === type);
}

function succeededRefundMinor(rows) {
  return movementRows(rows, "refund")
    .filter((row) => ["succeeded", "refunded"].includes(row.new_state))
    .reduce((sum, row) => sum + Math.max(Number(row.amount_minor ?? 0), 0), 0);
}

function containsFailureText(value, patterns) {
  const text = safeJson(value).toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
}

async function healthExactSha(productionUrl, expectedSha) {
  const response = await fetch(
    `${productionUrl.replace(/\/$/, "")}/api/health/build`,
    {
      headers: { accept: "application/json" },
      cache: "no-store",
    }
  );
  assert(response.ok, `Production build health returned HTTP ${response.status}.`);
  const body = await response.json();
  assert(body?.ok === true, "Production build health is not OK.");
  assert(
    body?.commitSha === expectedSha,
    `Deployed SHA mismatch: expected ${expectedSha}, got ${body?.commitSha ?? "null"}.`
  );
  assert(
    body?.environment === "production",
    `Vercel environment must be production, got ${body?.environment ?? "null"}.`
  );
  assert(
    body?.financialRuntime?.stripeMode === "live",
    "Controlled production certification requires KLYX_STRIPE_MODE=live."
  );
  assert(
    body?.financialRuntime?.generalLiveEnabled === false,
    "General LIVE payments must remain OFF during controlled certification."
  );
  assert(
    body?.financialRuntime?.controlledCertificationEnabled === true,
    "Controlled LIVE certification switch is not enabled."
  );
  assert(
    body?.financialRuntime?.drShaMatchesDeployment === true,
    "Deployed SHA is not the configured DR-certified SHA."
  );
  assert(
    body?.financialRuntime?.certificationShaMatchesDeployment === true,
    "Deployed SHA is not the configured controlled-certification SHA."
  );
}

async function reconcileBooking(productionUrl, secret, bookingId) {
  const response = await fetch(
    `${productionUrl.replace(/\/$/, "")}/api/ops/financial-reconciliation`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ bookingId }),
    }
  );

  assert(
    response.ok,
    `Central reconciliation HTTP ${response.status} for booking ${bookingId}.`
  );
  const body = await response.json();
  assert(body?.ok === true, `Central reconciliation failed for ${bookingId}.`);
  assert(
    body?.result?.status === "coherent",
    `Booking ${bookingId} is not coherent: ${safeJson(body?.result)}`
  );
}

async function loadEvidenceRef(supabase, ref, bookingIds) {
  assert(ALLOWED_AUTHORITIES.has(ref.authority), `Unknown evidence authority: ${ref.authority}`);
  assert(UUID_RE.test(ref.id), `Invalid evidence id for ${ref.authority}.`);

  if (ref.authority === "ledger") {
    const row = await getOne(
      supabase
        .from("financial_ledger_events")
        .select("id, booking_id, movement_type, amount_minor, new_state, stripe_transfer_id, stripe_transfer_reversal_id, stripe_refund_id")
        .eq("id", ref.id),
      "ledger evidence"
    );
    assert(row && bookingIds.includes(row.booking_id), "Ledger evidence is not attached to this cell.");
    return { authority: ref.authority, row };
  }

  if (ref.authority === "settlement_audit") {
    const row = await getOne(
      supabase
        .from("booking_settlement_reconciliation_events")
        .select("id, booking_id, source, action, outcome, reason_code, before_state, after_state, details")
        .eq("id", ref.id),
      "settlement audit evidence"
    );
    assert(row && bookingIds.includes(row.booking_id), "Settlement audit evidence is not attached to this cell.");
    return { authority: ref.authority, row };
  }

  if (ref.authority === "webhook") {
    const row = await getOne(
      supabase
        .from("stripe_webhook_events")
        .select("id, stripe_event_id, event_type, object_id, livemode, status, attempt_count, delivery_count, received_at, last_received_at, processed_at, last_error")
        .eq("id", ref.id),
      "webhook evidence"
    );
    assert(row, "Webhook evidence not found.");
    assert(row.livemode === true, "Certification webhook evidence must be LIVE.");
    return { authority: ref.authority, row };
  }

  if (ref.authority === "ops_event") {
    const row = await getOne(
      supabase
        .from("ops_events")
        .select("id, event_type, severity, domain_type, domain_resource_type, domain_resource_id, payment_provider, capability, metadata, created_at")
        .eq("id", ref.id),
      "ops event evidence"
    );
    assert(row, "Ops event evidence not found.");
    return { authority: ref.authority, row };
  }

  const row = await getOne(
    supabase
      .from("ops_durable_jobs")
      .select("id, domain_type, domain_resource_type, domain_resource_id, payment_provider, capability, job_type, status, attempt_count, max_attempts, last_error_code, last_failure_retryable, result_ref")
      .eq("id", ref.id),
    "durable job evidence"
  );
  assert(row, "Durable job evidence not found.");
  return { authority: ref.authority, row };
}

function validateHistoricalScenarioEvidence(scenario, evidence) {
  const byAuthority = (authority) =>
    evidence.filter((item) => item.authority === authority).map((item) => item.row);

  if (scenario === "failed_payment") {
    const rows = byAuthority("webhook");
    assert(
      rows.some(
        (row) =>
          row.status === "processed" &&
          ["payment_intent.payment_failed", "checkout.session.async_payment_failed"].includes(row.event_type)
      ),
      "failed_payment requires a processed LIVE Stripe failure webhook."
    );
  }

  if (scenario === "failed_transfer") {
    const audit = byAuthority("settlement_audit");
    const ops = byAuthority("ops_event");
    assert(
      audit.some(
        (row) =>
          row.outcome === "failed" &&
          containsFailureText(
            [row.action, row.reason_code, row.details],
            ["transfer", "release"]
          )
      ) ||
        ops.some(
          (row) =>
            ["error", "critical"].includes(row.severity) &&
            containsFailureText([row.event_type, row.metadata], ["transfer", "release"])
        ),
      "failed_transfer requires immutable failed transfer/release evidence."
    );
  }

  if (scenario === "late_webhook") {
    const audit = byAuthority("settlement_audit");
    const ops = byAuthority("ops_event");
    assert(
      audit.some(
        (row) =>
          row.outcome === "recovered" &&
          containsFailureText(row.action, ["recover_missing_payment_webhook", "recover_missing_refund_webhook"])
      ) ||
        ops.some((row) =>
          containsFailureText([row.event_type, row.metadata], ["late_webhook", "missing_webhook"])
        ),
      "late_webhook requires immutable recovery evidence."
    );
  }

  if (scenario === "duplicate_webhook") {
    const rows = byAuthority("webhook");
    assert(
      rows.some(
        (row) =>
          row.status === "processed" &&
          Number(row.delivery_count ?? 0) >= 2
      ),
      "duplicate_webhook requires a processed LIVE webhook with delivery_count >= 2."
    );
  }

  if (scenario === "timeout") {
    const ops = byAuthority("ops_event");
    const jobs = byAuthority("durable_job");
    assert(
      ops.some((row) =>
        containsFailureText([row.event_type, row.metadata], ["timeout", "timed_out"])
      ) ||
        jobs.some((row) =>
          containsFailureText(row.last_error_code, ["timeout", "timed_out"])
        ),
      "timeout requires immutable timeout evidence."
    );
  }

  if (scenario === "recovery") {
    const audit = byAuthority("settlement_audit");
    const ops = byAuthority("ops_event");
    const jobs = byAuthority("durable_job");
    assert(
      audit.some((row) => row.outcome === "recovered") ||
        ops.some((row) =>
          containsFailureText([row.event_type, row.metadata], ["recovery", "recovered", "reconcile"])
        ) ||
        jobs.some(
          (row) =>
            Number(row.attempt_count ?? 0) > 1 &&
            row.status === "completed"
        ),
      "recovery requires immutable recovered/retried evidence."
    );
  }
}

async function loadBookingTruth(supabase, bookingId) {
  const booking = await getOne(
    supabase
      .from("bookings")
      .select("id, parent_id, payment_status, payment_mode, amount_total, currency, platform_fee_amount, application_fee_amount, provider_amount, refunded_amount_cents, stripe_payment_intent_id, stripe_refund_id, booking_group_id, payment_failure_code, payment_failed_at")
      .eq("id", bookingId),
    "booking"
  );
  assert(booking, `Booking ${bookingId} not found.`);

  const [ledger, settlement, groupMembers, splitUnits] = await Promise.all([
    getMany(
      supabase
        .from("financial_ledger_current")
        .select("id, movement_type, amount_minor, currency, new_state, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id, stripe_refund_id")
        .eq("booking_id", bookingId),
      "financial ledger"
    ),
    getOne(
      supabase
        .from("booking_settlements")
        .select("booking_id, state, gross_amount_cents, platform_fee_cents, provider_amount_cents, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id, stripe_transfer_reversal_id")
        .eq("booking_id", bookingId),
      "booking settlement"
    ),
    getMany(
      supabase
        .from("platform_held_group_settlement_members")
        .select("id, group_settlement_id, batch_id, provider_account_id, state, gross_amount_cents, provider_amount_cents, released_amount_cents, reversed_amount_cents, refunded_gross_amount_cents, stripe_transfer_id")
        .contains("booking_ids", [bookingId]),
      "group member"
    ),
    getMany(
      supabase
        .from("split_booking_payment_units")
        .select("id, batch_id, provider_profile_id, status, refund_status, amount_cents, refunded_amount_cents, stripe_payment_intent_id, stripe_refund_id")
        .contains("booking_ids", [bookingId]),
      "split unit"
    ),
  ]);

  let groupParent = null;
  let allGroupMembers = [];
  if (groupMembers.length === 1) {
    groupParent = await getOne(
      supabase
        .from("platform_held_group_settlements")
        .select("id, batch_id, client_profile_id, state, gross_amount_cents, platform_fee_cents, provider_amount_cents, refunded_amount_cents, stripe_payment_intent_id, stripe_charge_id")
        .eq("id", groupMembers[0].group_settlement_id),
      "group parent"
    );
    allGroupMembers = await getMany(
      supabase
        .from("platform_held_group_settlement_members")
        .select("id, provider_account_id, booking_ids, state, stripe_transfer_id, released_amount_cents, reversed_amount_cents")
        .eq("group_settlement_id", groupMembers[0].group_settlement_id),
      "all group members"
    );
  }

  let splitBatch = null;
  const batchId = splitUnits[0]?.batch_id ?? groupParent?.batch_id ?? null;
  if (batchId) {
    splitBatch = await getOne(
      supabase
        .from("split_booking_batches")
        .select("id, status, expected_booking_count, provider_count, created_booking_count")
        .eq("id", batchId),
      "split batch"
    );
  }

  return {
    booking,
    ledger,
    settlement,
    groupMembers,
    groupParent,
    allGroupMembers,
    splitUnits,
    splitBatch,
  };
}

function validateTopology(topology, truth) {
  if (topology === "single") {
    assert(
      truth.booking.payment_mode === "platform_held" &&
        truth.groupMembers.length === 0 &&
        truth.splitUnits.length === 0,
      "single topology requires a non-group, non-split platform_held booking."
    );
    return;
  }

  if (topology === "group") {
    assert(
      truth.groupMembers.length === 1 && truth.groupParent,
      "group topology requires canonical platform-held group membership."
    );
    return;
  }

  if (topology === "split") {
    assert(
      truth.splitBatch && (truth.splitUnits.length > 0 || truth.groupParent?.batch_id === truth.splitBatch.id),
      "split topology requires canonical split batch evidence."
    );
    return;
  }

  const providers = new Set(
    truth.allGroupMembers
      .map((row) => row.provider_account_id)
      .filter((value) => typeof value === "string" && value.length > 0)
  );
  assert(
    truth.groupParent && providers.size >= 2,
    "multi_provider topology requires at least two distinct canonical provider accounts."
  );
}

function bookingGross(truth) {
  if (truth.groupMembers.length === 1) {
    return Math.max(Number(truth.groupMembers[0].gross_amount_cents ?? 0), 0);
  }
  return Math.max(Number(truth.booking.amount_total ?? 0), 0);
}

function validateCurrentScenarioState(scenario, truth) {
  const charge = movementRows(truth.ledger, "charge");
  const commission = movementRows(truth.ledger, "commission");
  const liability = movementRows(truth.ledger, "provider_liability");
  const transfers = movementRows(truth.ledger, "transfer");
  const reversals = movementRows(truth.ledger, "reversal");
  const refundMinor = succeededRefundMinor(truth.ledger);
  const gross = bookingGross(truth);

  if (scenario === "happy_path") {
    assert(["paid", "refunded"].includes(truth.booking.payment_status), "happy_path booking must be paid.");
    assert(charge.length > 0, "happy_path requires canonical charge movement.");
    assert(commission.length > 0, "happy_path requires canonical commission movement.");
    assert(liability.length > 0, "happy_path requires canonical provider liability movement.");
    assert(transfers.length > 0, "happy_path requires canonical Transfer movement.");
  }

  if (scenario === "partial_refund") {
    assert(gross > 0 && refundMinor > 0 && refundMinor < gross, "partial_refund amount must be > 0 and < gross.");
  }

  if (scenario === "full_refund") {
    assert(gross > 0 && refundMinor === gross, "full_refund must reconcile exactly to gross.");
  }

  if (scenario === "reversal") {
    assert(
      reversals.some((row) => row.stripe_transfer_reversal_id),
      "reversal requires canonical reversal movement with Stripe reversal id."
    );
  }

  if (scenario === "failed_payment") {
    assert(
      truth.booking.payment_status === "failed" ||
        Boolean(truth.booking.payment_failure_code) ||
        Boolean(truth.booking.payment_failed_at),
      "failed_payment requires canonical booking payment failure state."
    );
    assert(transfers.length === 0, "failed_payment must not contain a provider Transfer.");
  }
}

function validateManifest(manifest, expectedSha) {
  assert(manifest && typeof manifest === "object" && !Array.isArray(manifest), "Manifest must be an object.");
  assert(manifest.version === 1, "Manifest version must be 1.");
  assert(manifest.expectedSha === expectedSha, "Manifest SHA differs from workflow SHA.");
  assert(Array.isArray(manifest.cells), "Manifest cells must be an array.");
  assert(manifest.cells.length === SCENARIOS.length * TOPOLOGIES.length, "Manifest must contain exactly 40 cells.");

  const expected = new Set(
    SCENARIOS.flatMap((scenario) =>
      TOPOLOGIES.map((topology) => `${scenario}:${topology}`)
    )
  );
  const seen = new Set();

  for (const cell of manifest.cells) {
    assert(SCENARIOS.includes(cell.scenario), `Unknown scenario: ${cell.scenario}`);
    assert(TOPOLOGIES.includes(cell.topology), `Unknown topology: ${cell.topology}`);
    const key = `${cell.scenario}:${cell.topology}`;
    assert(!seen.has(key), `Duplicate matrix cell: ${key}`);
    seen.add(key);
    assert(Array.isArray(cell.bookingIds) && cell.bookingIds.length > 0, `${key} requires bookingIds.`);
    for (const bookingId of cell.bookingIds) {
      assert(UUID_RE.test(bookingId), `${key} contains invalid booking id.`);
    }
    assert(Array.isArray(cell.evidenceRefs) && cell.evidenceRefs.length > 0, `${key} requires evidenceRefs.`);
    for (const ref of cell.evidenceRefs) {
      assert(ref && typeof ref === "object", `${key} has invalid evidence ref.`);
      assert(ALLOWED_AUTHORITIES.has(ref.authority), `${key} has unsupported evidence authority.`);
      assert(UUID_RE.test(ref.id), `${key} has invalid evidence id.`);
    }
  }

  assert([...expected].every((key) => seen.has(key)), "Manifest matrix is incomplete.");
}

async function main() {
  const expectedSha = requiredEnv("KLYX_EXPECTED_SHA").toLowerCase();
  assert(SHA_RE.test(expectedSha), "KLYX_EXPECTED_SHA must be a full Git SHA.");

  const productionUrl = requiredEnv("KLYX_PRODUCTION_URL");
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const reconciliationSecret = requiredEnv("KLYX_FINANCIAL_RECONCILIATION_SECRET");
  const certificationProfileId = requiredEnv("KLYX_LIVE_CERTIFICATION_PROFILE_ID");
  assert(UUID_RE.test(certificationProfileId), "Certification profile id is invalid.");

  const { parsed: manifest, hash: manifestSha256 } = decodeManifest();
  validateManifest(manifest, expectedSha);
  await healthExactSha(productionUrl, expectedSha);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];

  for (const cell of manifest.cells) {
    const key = `${cell.scenario}:${cell.topology}`;
    const evidence = [];
    for (const ref of cell.evidenceRefs) {
      evidence.push(await loadEvidenceRef(supabase, ref, cell.bookingIds));
    }
    validateHistoricalScenarioEvidence(cell.scenario, evidence);

    for (const bookingId of cell.bookingIds) {
      const truth = await loadBookingTruth(supabase, bookingId);
      assert(
        truth.booking.parent_id === certificationProfileId,
        `${key} booking ${bookingId} does not belong to the controlled certification profile.`
      );
      validateTopology(cell.topology, truth);
      validateCurrentScenarioState(cell.scenario, truth);
      await reconcileBooking(productionUrl, reconciliationSecret, bookingId);
    }

    results.push({ key, bookings: cell.bookingIds.length, coherent: true });
    process.stdout.write(`CERTIFIED_CELL ${key} bookings=${cell.bookingIds.length}\n`);
  }

  const summary = {
    schemaVersion: 1,
    overall: "certified",
    expectedSha,
    manifestSha256,
    requiredCells: SCENARIOS.length * TOPOLOGIES.length,
    certifiedCells: results.length,
    generatedAt: new Date().toISOString(),
    noSilentCorrection: true,
    equalityInvariant: "klyx_ledger=settlement=stripe",
  };

  const outputDir = "production-financial-certification-proof";
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    `${outputDir}/summary.json`,
    JSON.stringify(summary, null, 2) + "\n",
    "utf8"
  );

  process.stdout.write(JSON.stringify(summary) + "\n");
}

main().catch((error) => {
  process.stderr.write(
    `KLYX_PRODUCTION_FINANCIAL_CERTIFICATION_FAILED: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});

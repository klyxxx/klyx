import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { canReceiveSettlement } from "@/lib/economic-settlement-eligibility-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const runtimeEnabled =
  process.env.KLYX_GOLDEN_PATH_LOCAL_SUPABASE === "true";

const runtimeDescribe = runtimeEnabled ? describe.sequential : describe.skip;

const ACTIVITY_KEY = "cleaning";
const JURISDICTION_CODE = "BE";
const QUALIFICATION_KEY = "economic.chain.certification";
const STRIPE_ACCOUNT_ID = "acct_klyx_economic_chain_runtime";

let authUserId = "";
let accountId = "";
let economicIdentityId = "";

function isoOffset(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function requireNoError(
  operation: PromiseLike<{ error: { message?: string } | null }>,
  label: string
): Promise<void> {
  const { error } = await operation;
  if (error) {
    throw new Error(`${label}: ${error.message ?? "unknown error"}`);
  }
}

async function insertTrustEligibility(subjectId: string): Promise<void> {
  await requireNoError(
    supabaseAdmin.from("trust_eligibility_decisions").insert({
      account_id: accountId,
      policy_id: null,
      target_type: "booking",
      target_ref: subjectId,
      category_key: ACTIVITY_KEY,
      jurisdiction_code: JURISDICTION_CODE,
      decision: "eligible",
      legal_pathway: "independent_compatible",
      decision_source: "policy_engine",
      human_review_required: false,
      review_status: "not_required",
      reason_codes: [],
      required_actions: [],
      explanation:
        "Ephemeral economic-chain certification decision for isolated Supabase.",
      input_snapshot: {
        certification: "economic_chain_runtime",
      },
      expires_at: isoOffset(30),
    }),
    "Unable to insert trust eligibility baseline"
  );
}

async function resetVerifiedBaseline(subjectId: string): Promise<void> {
  await requireNoError(
    supabaseAdmin
      .from("account_actor_capabilities")
      .upsert(
        {
          account_id: accountId,
          capability: "offer_services",
          enabled: true,
          source: "system",
          metadata: {
            certification: "economic_chain_runtime",
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,capability" }
      ),
    "Unable to enable offer_services"
  );

  await requireNoError(
    supabaseAdmin
      .from("economic_identities")
      .update({
        status: "ready",
        primary_country_code: JURISDICTION_CODE,
        human_review_required: false,
        review_reason_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", economicIdentityId)
      .eq("account_id", accountId),
    "Unable to reset economic identity"
  );

  await requireNoError(
    supabaseAdmin
      .from("economic_restrictions")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    "Unable to clear economic restrictions"
  );

  await requireNoError(
    supabaseAdmin
      .from("trust_restrictions")
      .delete()
      .eq("account_id", accountId),
    "Unable to clear trust restrictions"
  );

  await requireNoError(
    supabaseAdmin
      .from("economic_legal_entities")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    "Unable to clear legal entities"
  );

  const { data: legalEntity, error: legalEntityError } = await supabaseAdmin
    .from("economic_legal_entities")
    .insert({
      economic_identity_id: economicIdentityId,
      entity_type: "individual",
      is_primary: true,
      legal_name: "KLYX Economic Chain Certification",
      country_code: JURISDICTION_CODE,
      source: "migration",
      verification_status: "verified",
      verified_at: isoOffset(-60),
      expires_at: isoOffset(60),
    })
    .select("id")
    .single();

  if (legalEntityError || !legalEntity?.id) {
    throw new Error(
      `Unable to create verified legal entity: ${
        legalEntityError?.message ?? "missing id"
      }`
    );
  }

  const { data: verification, error: verificationError } = await supabaseAdmin
    .from("economic_verification_cases")
    .insert({
      economic_identity_id: economicIdentityId,
      legal_entity_id: legalEntity.id,
      economic_person_id: null,
      verification_type: "kyc",
      provider: "klyx.test",
      status: "verified",
      decision_source: "deterministic_rule",
      human_review_required: false,
      verified_at: isoOffset(-30),
      expires_at: isoOffset(60),
      provider_observed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (verificationError || !verification?.id) {
    throw new Error(
      `Unable to create verified KYC case: ${
        verificationError?.message ?? "missing id"
      }`
    );
  }

  await requireNoError(
    supabaseAdmin
      .from("account_capability_qualifications")
      .delete()
      .eq("account_id", accountId)
      .eq("capability", "offer_services")
      .eq("qualification_key", QUALIFICATION_KEY),
    "Unable to clear certification qualification"
  );

  await requireNoError(
    supabaseAdmin.from("account_capability_qualifications").insert({
      account_id: accountId,
      capability: "offer_services",
      qualification_key: QUALIFICATION_KEY,
      scope_type: "activity",
      scope_key: ACTIVITY_KEY,
      status: "approved",
      source: "system",
      evidence: {
        certification: "economic_chain_runtime",
      },
      valid_from: isoOffset(-30),
      valid_until: isoOffset(60),
      activity_key: ACTIVITY_KEY,
      jurisdiction_code: JURISDICTION_CODE,
    }),
    "Unable to create approved qualification"
  );

  await requireNoError(
    supabaseAdmin
      .from("economic_stripe_account_projections")
      .update({
        country_code: JURISDICTION_CODE,
        business_type: "individual",
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        currently_due: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
        requirement_errors: [],
        disabled_reason: null,
        capabilities: {
          transfers: "active",
        },
        provider_observed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("economic_identity_id", economicIdentityId)
      .eq("account_id", accountId)
      .eq("stripe_account_id", STRIPE_ACCOUNT_ID),
    "Unable to reset Stripe projection"
  );

  await insertTrustEligibility(subjectId);
}

async function evaluate(
  subjectId: string,
  expectedDecision: "allowed" | "human_review" | "blocked",
  expectedReason?: string
): Promise<void> {
  const result = await canReceiveSettlement({
    accountId,
    activityKey: ACTIVITY_KEY,
    jurisdictionCode: JURISDICTION_CODE,
    subjectType: "booking",
    subjectId,
    expectedStripeAccountId: STRIPE_ACCOUNT_ID,
  });

  expect(result.decision).toBe(expectedDecision);

  if (expectedReason) {
    expect(result.reasonCodes).toContain(expectedReason);
  }

  const { data: persisted, error } = await supabaseAdmin
    .from("economic_settlement_eligibility_decisions")
    .select("decision, reason_codes, evidence_snapshot")
    .eq("id", result.decisionId)
    .single();

  if (error || !persisted) {
    throw new Error(
      `Unable to read persisted economic decision: ${
        error?.message ?? "missing row"
      }`
    );
  }

  expect(persisted.decision).toBe(expectedDecision);
  if (expectedReason) {
    expect(persisted.reason_codes).toContain(expectedReason);
  }
  expect(persisted.evidence_snapshot).toMatchObject({
    economicIdentityStatus:
      expectedReason === "ECONOMIC_IDENTITY_RESTRICTED"
        ? "restricted"
        : "ready",
  });
}

runtimeDescribe("economic chain real runtime certification", () => {
  beforeAll(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    const parsed = new URL(url);

    if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error(
        "Economic-chain runtime certification refuses non-loopback Supabase."
      );
    }

    const email = `economic-chain-${randomUUID()}@example.test`;
    const password = `Klyx-${randomUUID()}-Aa1!`;

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !created.user?.id) {
      throw new Error(
        `Unable to create isolated certification auth user: ${
          createError?.message ?? "missing user"
        }`
      );
    }

    authUserId = created.user.id;

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("auth_user_id", authUserId)
      .single();

    if (accountError || !account?.id) {
      throw new Error(
        `Unable to resolve isolated canonical account: ${
          accountError?.message ?? "missing account"
        }`
      );
    }

    accountId = String(account.id);

    const { data: identity, error: identityError } = await supabaseAdmin
      .from("economic_identities")
      .select("id")
      .eq("account_id", accountId)
      .single();

    if (identityError || !identity?.id) {
      throw new Error(
        `Unable to resolve isolated economic identity: ${
          identityError?.message ?? "missing identity"
        }`
      );
    }

    economicIdentityId = String(identity.id);

    await requireNoError(
      supabaseAdmin.from("account_stripe_connect_identities").insert({
        account_id: accountId,
        stripe_account_id: STRIPE_ACCOUNT_ID,
        identity_state: "linked",
        source_profile_ids: [],
        conflicting_stripe_account_ids: [],
      }),
      "Unable to bind isolated Stripe identity"
    );

    await requireNoError(
      supabaseAdmin.from("economic_stripe_account_projections").insert({
        economic_identity_id: economicIdentityId,
        account_id: accountId,
        stripe_account_id: STRIPE_ACCOUNT_ID,
        country_code: JURISDICTION_CODE,
        business_type: "individual",
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        currently_due: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
        requirement_errors: [],
        disabled_reason: null,
        capabilities: {
          transfers: "active",
        },
        provider_observed_at: new Date().toISOString(),
      }),
      "Unable to create isolated Stripe projection"
    );
  }, 20_000);

  afterAll(async () => {
    if (!authUserId) return;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (error) {
      throw new Error(
        `Unable to destroy isolated economic-chain user: ${error.message}`
      );
    }
  }, 20_000);

  it("allows the complete verified chain", async () => {
    const subjectId = `cert-verified-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);
    await evaluate(subjectId, "allowed");
  });

  it("blocks pending KYC/KYB", async () => {
    const subjectId = `cert-pending-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_verification_cases")
        .update({
          status: "pending",
          verified_at: null,
          expires_at: null,
        })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to set KYC pending"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ECONOMIC_VERIFICATION_NOT_SATISFIED"
    );
  });

  it("blocks expired KYC/KYB even when the stored status still says verified", async () => {
    const subjectId = `cert-expired-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_verification_cases")
        .update({
          status: "verified",
          verified_at: isoOffset(-120),
          expires_at: isoOffset(-1),
        })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to set KYC expiry"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ECONOMIC_VERIFICATION_EXPIRED"
    );
  });

  it("blocks restricted KYC/KYB", async () => {
    const subjectId = `cert-restricted-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_verification_cases")
        .update({
          status: "restricted",
          verified_at: null,
          expires_at: null,
        })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to set KYC restricted"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ECONOMIC_VERIFICATION_NOT_SATISFIED"
    );
  });

  it("blocks when the activity qualification is missing", async () => {
    const subjectId = `cert-qualification-missing-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("account_capability_qualifications")
        .delete()
        .eq("account_id", accountId)
        .eq("capability", "offer_services")
        .eq("qualification_key", QUALIFICATION_KEY),
      "Unable to remove qualification"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ACCOUNT_QUALIFICATION_MISSING"
    );
  });

  it("blocks a country-scoped economic restriction", async () => {
    const subjectId = `cert-country-restricted-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin.from("economic_restrictions").insert({
        economic_identity_id: economicIdentityId,
        restricted_action: "receive_settlement",
        scope_type: "jurisdiction",
        activity_key: null,
        jurisdiction_code: JURISDICTION_CODE,
        status: "active",
        source: "deterministic_rule",
        reason_code: "COUNTRY_RESTRICTED",
        human_review_required: false,
      }),
      "Unable to create country restriction"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ECONOMIC_RESTRICTION_ACTIVE"
    );
  });

  it("blocks when Stripe payouts are disabled", async () => {
    const subjectId = `cert-payouts-disabled-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_stripe_account_projections")
        .update({ payouts_enabled: false })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to disable Stripe payouts"
    );

    await evaluate(
      subjectId,
      "blocked",
      "STRIPE_PAYOUTS_NOT_ENABLED"
    );
  });

  it("blocks when Stripe requirements are currently due", async () => {
    const subjectId = `cert-requirements-due-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_stripe_account_projections")
        .update({
          currently_due: ["individual.verification.document"],
        })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to set Stripe requirements due"
    );

    await evaluate(
      subjectId,
      "blocked",
      "STRIPE_REQUIREMENTS_CURRENTLY_DUE"
    );
  });

  it("routes human-review KYC/KYB to human_review instead of allowing money movement", async () => {
    const subjectId = `cert-human-review-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    await requireNoError(
      supabaseAdmin
        .from("economic_verification_cases")
        .update({
          status: "human_review",
          human_review_required: true,
          verified_at: null,
          expires_at: null,
        })
        .eq("economic_identity_id", economicIdentityId),
      "Unable to set KYC human review"
    );

    await evaluate(
      subjectId,
      "human_review",
      "ECONOMIC_VERIFICATION_HUMAN_REVIEW_REQUIRED"
    );
  });

  it("proves Stripe OK is still blocked when KLYX eligibility is blocked", async () => {
    const subjectId = `cert-stripe-ok-klyx-blocked-${randomUUID()}`;
    await resetVerifiedBaseline(subjectId);

    const { data: stripeProjection, error: stripeError } = await supabaseAdmin
      .from("economic_stripe_account_projections")
      .select(
        "details_submitted, payouts_enabled, currently_due, past_due, pending_verification, requirement_errors, disabled_reason, capabilities"
      )
      .eq("economic_identity_id", economicIdentityId)
      .single();

    if (stripeError || !stripeProjection) {
      throw new Error(
        `Unable to read Stripe-ready projection: ${
          stripeError?.message ?? "missing projection"
        }`
      );
    }

    expect(stripeProjection).toMatchObject({
      details_submitted: true,
      payouts_enabled: true,
      currently_due: [],
      past_due: [],
      pending_verification: [],
      requirement_errors: [],
      disabled_reason: null,
      capabilities: {
        transfers: "active",
      },
    });

    await requireNoError(
      supabaseAdmin.from("economic_restrictions").insert({
        economic_identity_id: economicIdentityId,
        restricted_action: "receive_settlement",
        scope_type: "global",
        activity_key: null,
        jurisdiction_code: null,
        status: "active",
        source: "deterministic_rule",
        reason_code: "KLYX_ELIGIBILITY_BLOCKED",
        human_review_required: false,
      }),
      "Unable to create KLYX-only block"
    );

    await evaluate(
      subjectId,
      "blocked",
      "ECONOMIC_RESTRICTION_ACTIVE"
    );
  });
});

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { canReceiveSettlement } from "@/lib/economic-settlement-eligibility-server";

const runtimeEnabled =
  process.env.KLYX_ECONOMIC_CHAIN_RUNTIME === "true";

const describeRuntime = runtimeEnabled ? describe : describe.skip;
const HANDOFF_PATH =
  "stripe-network-proof/platform-held-provider-fixture.json";

type RuntimeContext = {
  admin: SupabaseClient;
  accountId: string;
  providerProfileId: string;
  userServiceId: string;
  activityKey: string;
  jurisdictionCode: string;
  economicIdentityId: string;
  stripeAccountId: string;
};

type Baseline = {
  legalEntityId: string;
  personId: string;
  verificationCaseId: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing runtime env: ${name}`);
  return value;
}

function stripeAccountIdFromRuntime(): string {
  const explicit =
    process.env.KLYX_ECONOMIC_CHAIN_STRIPE_ACCOUNT_ID?.trim();
  if (explicit) return explicit;

  if (!fs.existsSync(HANDOFF_PATH)) {
    throw new Error(
      "Economic-chain runtime requires a Stripe TEST account handoff."
    );
  }

  const handoff = JSON.parse(
    fs.readFileSync(HANDOFF_PATH, "utf8")
  ) as { accountId?: unknown; testMode?: unknown };

  if (
    handoff.testMode !== true ||
    typeof handoff.accountId !== "string" ||
    !handoff.accountId.startsWith("acct_")
  ) {
    throw new Error("Economic-chain Stripe handoff is invalid.");
  }

  return handoff.accountId;
}

async function loadContext(): Promise<RuntimeContext> {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requiredEnv("KLYX_E2E_EMAIL");

  if (
    !url.startsWith("http://127.0.0.1:") &&
    !url.startsWith("http://localhost:")
  ) {
    throw new Error(
      "Economic-chain runtime refuses non-loopback Supabase."
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: usersError } =
    await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(usersError.message);

  const user = users.users.find(
    (candidate) =>
      candidate.email?.toLowerCase() === email.toLowerCase()
  );
  if (!user) throw new Error("Economic-chain auth fixture is missing.");

  const { data: account, error: accountError } = await admin
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (accountError || !account?.id) {
    throw new Error(accountError?.message ?? "Canonical account missing.");
  }

  const { data: provider, error: providerError } = await admin
    .from("profiles")
    .select("id, account_id, country_code")
    .eq("owner_user_id", user.id)
    .eq("account_type", "provider")
    .single();
  if (providerError || !provider?.id) {
    throw new Error(providerError?.message ?? "Provider profile missing.");
  }
  if (provider.account_id !== account.id) {
    throw new Error("Provider does not resolve to canonical account.");
  }

  const { data: userService, error: userServiceError } = await admin
    .from("user_services")
    .select("id, services(slug)")
    .eq("user_id", provider.id)
    .eq("active", true)
    .eq("provider_enabled", true)
    .limit(1)
    .single();
  if (userServiceError || !userService?.id) {
    throw new Error(
      userServiceError?.message ?? "Provider service missing."
    );
  }

  const serviceRelation = Array.isArray(userService.services)
    ? userService.services[0]
    : userService.services;
  const activityKey = serviceRelation?.slug;
  if (typeof activityKey !== "string" || !activityKey) {
    throw new Error("Provider activity slug missing.");
  }

  const { data: identity, error: identityError } = await admin
    .from("economic_identities")
    .select("id")
    .eq("account_id", account.id)
    .single();
  if (identityError || !identity?.id) {
    throw new Error(
      identityError?.message ?? "Economic identity missing."
    );
  }

  return {
    admin,
    accountId: account.id,
    providerProfileId: provider.id,
    userServiceId: userService.id,
    activityKey,
    jurisdictionCode: String(provider.country_code ?? "BE").toUpperCase(),
    economicIdentityId: identity.id,
    stripeAccountId: stripeAccountIdFromRuntime(),
  };
}

async function clearScenarioFacts(context: RuntimeContext) {
  const { admin, accountId, economicIdentityId } = context;

  for (const operation of [
    admin
      .from("economic_restrictions")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    admin
      .from("economic_verification_cases")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    admin
      .from("economic_persons")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    admin
      .from("economic_legal_entities")
      .delete()
      .eq("economic_identity_id", economicIdentityId),
    admin
      .from("account_capability_qualifications")
      .delete()
      .eq("account_id", accountId)
      .eq("capability", "offer_services"),
  ]) {
    const { error } = await operation;
    if (error) throw new Error(error.message);
  }
}

async function establishBaseline(
  context: RuntimeContext,
  subjectId: string
): Promise<Baseline> {
  const {
    admin,
    accountId,
    providerProfileId,
    userServiceId,
    activityKey,
    jurisdictionCode,
    economicIdentityId,
    stripeAccountId,
  } = context;

  await clearScenarioFacts(context);

  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { error: identityError } = await admin
    .from("economic_identities")
    .update({
      status: "ready",
      primary_country_code: jurisdictionCode,
      human_review_required: false,
      review_reason_code: null,
      updated_at: now.toISOString(),
    })
    .eq("id", economicIdentityId)
    .eq("account_id", accountId);
  if (identityError) throw new Error(identityError.message);

  const { error: capabilityError } = await admin
    .from("account_actor_capabilities")
    .upsert(
      {
        account_id: accountId,
        capability: "offer_services",
        enabled: true,
        source: "system",
        updated_at: now.toISOString(),
      },
      { onConflict: "account_id,capability" }
    );
  if (capabilityError) throw new Error(capabilityError.message);

  const { data: legalEntity, error: legalEntityError } = await admin
    .from("economic_legal_entities")
    .insert({
      economic_identity_id: economicIdentityId,
      entity_type: "individual",
      is_primary: true,
      legal_name: "KLYX Economic Chain TEST",
      country_code: jurisdictionCode,
      source: "trusted_provider",
      external_provider: "klyx_test",
      external_reference: `entity:${subjectId}`,
      verification_status: "verified",
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
    })
    .select("id")
    .single();
  if (legalEntityError || !legalEntity?.id) {
    throw new Error(
      legalEntityError?.message ?? "Legal entity fixture missing."
    );
  }

  const { data: person, error: personError } = await admin
    .from("economic_persons")
    .insert({
      economic_identity_id: economicIdentityId,
      legal_entity_id: legalEntity.id,
      relationship: "self",
      is_primary: true,
      source: "trusted_provider",
      external_provider: "klyx_test",
      external_reference: `person:${subjectId}`,
      verification_status: "verified",
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
    })
    .select("id")
    .single();
  if (personError || !person?.id) {
    throw new Error(personError?.message ?? "Person fixture missing.");
  }

  const { data: verification, error: verificationError } = await admin
    .from("economic_verification_cases")
    .insert({
      economic_identity_id: economicIdentityId,
      legal_entity_id: legalEntity.id,
      economic_person_id: person.id,
      verification_type: "kyc",
      provider: "klyx_test",
      external_reference: `kyc:${subjectId}`,
      requirement_key: "identity",
      status: "verified",
      decision_source: "trusted_provider",
      reason_code: "certification_verified",
      human_review_required: false,
      verified_at: now.toISOString(),
      expires_at: future.toISOString(),
      provider_observed_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (verificationError || !verification?.id) {
    throw new Error(
      verificationError?.message ?? "KYC fixture missing."
    );
  }

  const { error: qualificationError } = await admin
    .from("account_capability_qualifications")
    .insert({
      account_id: accountId,
      capability: "offer_services",
      qualification_key: "economic_chain_certified",
      scope_type: "user_service",
      scope_key: userServiceId,
      status: "approved",
      source: "system",
      evidence: { certification: true },
      valid_from: now.toISOString(),
      valid_until: future.toISOString(),
      activity_key: activityKey,
      jurisdiction_code: jurisdictionCode,
    });
  if (qualificationError) throw new Error(qualificationError.message);

  const { error: trustDecisionError } = await admin
    .from("trust_eligibility_decisions")
    .insert({
      account_id: accountId,
      target_type: "booking",
      target_ref: subjectId,
      category_key: activityKey,
      jurisdiction_code: jurisdictionCode,
      decision: "eligible",
      legal_pathway: "independent_compatible",
      decision_source: "policy_engine",
      human_review_required: false,
      review_status: "not_required",
      reason_codes: [],
      required_actions: [],
      explanation:
        "Ephemeral economic-chain certification decision.",
      input_snapshot: {
        certification: true,
        providerProfileId,
      },
      expires_at: future.toISOString(),
    });
  if (trustDecisionError) throw new Error(trustDecisionError.message);

  const { error: canonicalStripeError } = await admin
    .from("account_stripe_connect_identities")
    .upsert(
      {
        account_id: accountId,
        stripe_account_id: stripeAccountId,
        identity_state: "linked",
        source_profile_ids: [providerProfileId],
        conflicting_stripe_account_ids: [],
        updated_at: now.toISOString(),
      },
      { onConflict: "account_id" }
    );
  if (canonicalStripeError) {
    throw new Error(canonicalStripeError.message);
  }

  const { error: projectionError } = await admin
    .from("economic_stripe_account_projections")
    .upsert(
      {
        economic_identity_id: economicIdentityId,
        account_id: accountId,
        stripe_account_id: stripeAccountId,
        country_code: jurisdictionCode,
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
        capabilities: { transfers: "active" },
        provider_observed_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "economic_identity_id" }
    );
  if (projectionError) throw new Error(projectionError.message);

  return {
    legalEntityId: legalEntity.id,
    personId: person.id,
    verificationCaseId: verification.id,
  };
}

async function evaluate(
  context: RuntimeContext,
  subjectId: string
) {
  return canReceiveSettlement({
    accountId: context.accountId,
    activityKey: context.activityKey,
    jurisdictionCode: context.jurisdictionCode,
    subjectType: "booking",
    subjectId,
    expectedStripeAccountId: context.stripeAccountId,
    userServiceId: context.userServiceId,
  });
}

describeRuntime(
  "KLYX economic chain runtime certification",
  () => {
    let context: RuntimeContext;

    beforeAll(async () => {
      context = await loadContext();
    });

    afterAll(async () => {
      if (context) await clearScenarioFacts(context);
    });

    it("certifies the requested economic-state matrix fail-closed", async () => {
      const cases: Array<{
        name: string;
        expectedDecision: "allowed" | "blocked" | "human_review";
        expectedReason?: string;
        mutate?: (
          context: RuntimeContext,
          baseline: Baseline
        ) => Promise<void>;
      }> = [
        {
          name: "verified",
          expectedDecision: "allowed",
        },
        {
          name: "pending",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_VERIFICATION_NOT_SATISFIED",
          mutate: async ({ admin }, baseline) => {
            const { error } = await admin
              .from("economic_verification_cases")
              .update({
                status: "pending",
                verified_at: null,
                expires_at: null,
              })
              .eq("id", baseline.verificationCaseId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "expired",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_VERIFICATION_NOT_SATISFIED",
          mutate: async ({ admin }, baseline) => {
            const now = Date.now();
            const { error } = await admin
              .from("economic_verification_cases")
              .update({
                status: "verified",
                verified_at: new Date(
                  now - 48 * 60 * 60 * 1000
                ).toISOString(),
                expires_at: new Date(
                  now - 24 * 60 * 60 * 1000
                ).toISOString(),
              })
              .eq("id", baseline.verificationCaseId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "restricted",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_IDENTITY_RESTRICTED",
          mutate: async ({ admin, economicIdentityId }) => {
            const { error } = await admin
              .from("economic_identities")
              .update({ status: "restricted" })
              .eq("id", economicIdentityId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "qualification_missing",
          expectedDecision: "blocked",
          expectedReason: "ACCOUNT_QUALIFICATION_MISSING",
          mutate: async ({ admin, accountId }) => {
            const { error } = await admin
              .from("account_capability_qualifications")
              .delete()
              .eq("account_id", accountId)
              .eq("capability", "offer_services");
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "country_restricted",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_RESTRICTION_ACTIVE",
          mutate: async ({
            admin,
            economicIdentityId,
            jurisdictionCode,
          }) => {
            const { error } = await admin
              .from("economic_restrictions")
              .insert({
                economic_identity_id: economicIdentityId,
                restricted_action: "receive_settlement",
                scope_type: "jurisdiction",
                activity_key: null,
                jurisdiction_code: jurisdictionCode,
                status: "active",
                source: "deterministic_rule",
                reason_code: "country_restricted",
                human_review_required: false,
              });
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "stripe_payouts_disabled",
          expectedDecision: "blocked",
          expectedReason: "STRIPE_PAYOUTS_NOT_ENABLED",
          mutate: async ({ admin, economicIdentityId }) => {
            const { error } = await admin
              .from("economic_stripe_account_projections")
              .update({ payouts_enabled: false })
              .eq("economic_identity_id", economicIdentityId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "stripe_requirements_due",
          expectedDecision: "blocked",
          expectedReason: "STRIPE_REQUIREMENTS_CURRENTLY_DUE",
          mutate: async ({ admin, economicIdentityId }) => {
            const { error } = await admin
              .from("economic_stripe_account_projections")
              .update({
                currently_due: ["individual.verification.document"],
              })
              .eq("economic_identity_id", economicIdentityId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "human_review",
          expectedDecision: "human_review",
          expectedReason:
            "ECONOMIC_VERIFICATION_HUMAN_REVIEW_REQUIRED",
          mutate: async ({ admin }, baseline) => {
            const { error } = await admin
              .from("economic_verification_cases")
              .update({
                status: "human_review",
                human_review_required: true,
              })
              .eq("id", baseline.verificationCaseId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "legal_entity_missing",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_LEGAL_ENTITY_MISSING",
          mutate: async ({ admin, economicIdentityId }) => {
            const { error } = await admin
              .from("economic_legal_entities")
              .delete()
              .eq("economic_identity_id", economicIdentityId);
            if (error) throw new Error(error.message);
          },
        },
        {
          name: "person_missing",
          expectedDecision: "blocked",
          expectedReason: "ECONOMIC_PERSON_MISSING",
          mutate: async ({ admin, economicIdentityId }) => {
            const { error } = await admin
              .from("economic_persons")
              .delete()
              .eq("economic_identity_id", economicIdentityId);
            if (error) throw new Error(error.message);
          },
        },
      ];

      for (const testCase of cases) {
        const subjectId =
          `economic-cert:${testCase.name}:${randomUUID()}`;
        const baseline = await establishBaseline(context, subjectId);

        if (testCase.mutate) {
          await testCase.mutate(context, baseline);
        }

        const result = await evaluate(context, subjectId);

        expect(
          result.decision,
          `${testCase.name} decision`
        ).toBe(testCase.expectedDecision);

        if (testCase.expectedReason) {
          expect(
            result.reasonCodes,
            `${testCase.name} reason codes`
          ).toContain(testCase.expectedReason);
        }
      }
    });
  }
);

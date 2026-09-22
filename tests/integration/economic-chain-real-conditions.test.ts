// Certification trigger: economic-chain real-conditions 2026-09-22
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type EligibilityResult = Awaited<
  ReturnType<
    typeof import("@/lib/economic-settlement-eligibility-server")["canReceiveSettlement"]
  >
>;

type Evaluator = typeof import(
  "@/lib/economic-settlement-eligibility-server"
)["canReceiveSettlement"];

const enabled =
  process.env.KLYX_ECONOMIC_CHAIN_REAL_CONDITIONS === "true";

describe.skipIf(!enabled)(
  "economic chain real-conditions matrix on ephemeral Supabase",
  () => {
    let admin: SupabaseClient;
    let evaluate: Evaluator;
    let accountId = "";
    let providerProfileId = "";
    let userServiceId = "";
    let activityKey = "";
    let jurisdictionCode = "";
    let economicIdentityId = "";
    let legalEntityId = "";
    let economicPersonId = "";
    let verificationCaseId = "";
    let stripeAccountId = "";

    const nowIso = () => new Date().toISOString();

    async function must<T>(
      promise: PromiseLike<{ data: T; error: { message: string } | null }>,
      label: string
    ): Promise<T> {
      const { data, error } = await promise;
      if (error) throw new Error(`${label}: ${error.message}`);
      return data;
    }

    async function seedTrustDecision(input: {
      subjectId: string;
      decision?: string;
      humanReviewRequired?: boolean;
      reviewStatus?: string;
      reasonCodes?: string[];
      requiredActions?: Array<{ code: string; detail?: string }>;
    }) {
      await must(
        admin.from("trust_eligibility_decisions").insert({
          account_id: accountId,
          target_type: "booking",
          target_ref: input.subjectId,
          category_key: activityKey,
          jurisdiction_code: jurisdictionCode,
          decision: input.decision ?? "eligible",
          legal_pathway: "independent_compatible",
          decision_source: "policy_engine",
          human_review_required: input.humanReviewRequired ?? false,
          review_status: input.reviewStatus ?? "not_required",
          reason_codes: input.reasonCodes ?? [],
          required_actions: input.requiredActions ?? [],
          explanation:
            "Ephemeral real-conditions economic-chain certification decision.",
          input_snapshot: {
            certification: "economic_chain_real_conditions",
          },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }),
        "seed trust eligibility decision"
      );
    }

    async function seedQualification() {
      await must(
        admin.from("account_capability_qualifications").upsert(
          {
            account_id: accountId,
            capability: "offer_services",
            qualification_key: "real_conditions_certification",
            scope_type: "user_service",
            scope_key: userServiceId,
            status: "approved",
            source: "system",
            evidence: {
              certification: "economic_chain_real_conditions",
            },
            activity_key: activityKey,
            jurisdiction_code: jurisdictionCode,
            valid_from: new Date(Date.now() - 60_000).toISOString(),
            valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: nowIso(),
          },
          {
            onConflict:
              "account_id,capability,qualification_key,scope_type,scope_key",
          }
        ),
        "seed qualification"
      );
    }

    async function resetBaseline() {
      await must(
        admin
          .from("economic_identities")
          .update({
            status: "ready",
            primary_country_code: jurisdictionCode,
            human_review_required: false,
            review_reason_code: null,
            updated_at: nowIso(),
          })
          .eq("id", economicIdentityId),
        "reset economic identity"
      );

      await must(
        admin
          .from("economic_legal_entities")
          .update({
            verification_status: "verified",
            verified_at: nowIso(),
            expires_at: null,
            updated_at: nowIso(),
          })
          .eq("id", legalEntityId),
        "reset legal entity"
      );

      await must(
        admin
          .from("economic_persons")
          .update({
            verification_status: "verified",
            verified_at: nowIso(),
            expires_at: null,
            updated_at: nowIso(),
          })
          .eq("id", economicPersonId),
        "reset economic person"
      );

      await must(
        admin
          .from("economic_verification_cases")
          .update({
            status: "verified",
            human_review_required: false,
            reason_code: null,
            verified_at: nowIso(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            provider_observed_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq("id", verificationCaseId),
        "reset verification case"
      );

      await must(
        admin
          .from("economic_restrictions")
          .delete()
          .eq("economic_identity_id", economicIdentityId)
          .like("reason_code", "certification_%"),
        "clear certification restrictions"
      );

      await must(
        admin
          .from("account_capability_qualifications")
          .delete()
          .eq("account_id", accountId)
          .eq("capability", "offer_services")
          .eq("qualification_key", "real_conditions_certification"),
        "clear certification qualification"
      );
      await seedQualification();

      await must(
        admin
          .from("account_actor_capabilities")
          .upsert(
            {
              account_id: accountId,
              capability: "offer_services",
              enabled: true,
              source: "system",
              metadata: {
                certification: "economic_chain_real_conditions",
              },
              updated_at: nowIso(),
            },
            { onConflict: "account_id,capability" }
          ),
        "reset offer-services capability"
      );

      await must(
        admin
          .from("account_stripe_connect_identities")
          .upsert(
            {
              account_id: accountId,
              stripe_account_id: stripeAccountId,
              identity_state: "linked",
              source_profile_ids: [providerProfileId],
              conflicting_stripe_account_ids: [],
              updated_at: nowIso(),
            },
            { onConflict: "account_id" }
          ),
        "reset canonical Stripe identity"
      );

      await must(
        admin
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
              capabilities: {
                transfers: "active",
              },
              provider_observed_at: nowIso(),
              updated_at: nowIso(),
            },
            { onConflict: "economic_identity_id" }
          ),
        "reset Stripe projection"
      );
    }

    async function runCase(input: {
      name: string;
      prepare?: () => Promise<void>;
      trust?: Omit<Parameters<typeof seedTrustDecision>[0], "subjectId">;
    }): Promise<EligibilityResult> {
      await resetBaseline();
      if (input.prepare) await input.prepare();

      const subjectId = `cert-${input.name}-${randomUUID()}`;
      await seedTrustDecision({
        subjectId,
        ...(input.trust ?? {}),
      });

      return evaluate({
        accountId,
        activityKey,
        jurisdictionCode,
        subjectType: "booking",
        subjectId,
        expectedStripeAccountId: stripeAccountId,
        userServiceId,
      });
    }

    beforeAll(async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

      if (!supabaseUrl || !serviceRole) {
        throw new Error(
          "Real-conditions matrix requires local Supabase URL and service role."
        );
      }

      const host = new URL(supabaseUrl).hostname;
      if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
        throw new Error(
          "Real-conditions matrix refuses non-loopback Supabase."
        );
      }

      admin = createClient(supabaseUrl, serviceRole, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      ({ canReceiveSettlement: evaluate } = await import(
        "@/lib/economic-settlement-eligibility-server"
      ));

      const profiles = await must(
        admin
          .from("profiles")
          .select("id, account_id, account_type, country_code")
          .eq("account_type", "provider")
          .limit(10),
        "load provider profile"
      );
      const provider = (profiles ?? []).find(
        (row: {
          id: string;
          account_id: string | null;
          country_code: string | null;
        }) => Boolean(row.account_id && row.country_code)
      );

      if (!provider?.account_id || !provider.country_code) {
        throw new Error("Ephemeral provider/account fixture is missing.");
      }

      providerProfileId = provider.id;
      accountId = provider.account_id;
      jurisdictionCode = provider.country_code.trim().toUpperCase();

      const userServices = await must(
        admin
          .from("user_services")
          .select("id, service_id")
          .eq("user_id", providerProfileId)
          .eq("active", true)
          .eq("provider_enabled", true)
          .limit(10),
        "load provider service"
      );
      const userService = (userServices ?? [])[0];
      if (!userService?.id || !userService.service_id) {
        throw new Error("Ephemeral provider service fixture is missing.");
      }

      userServiceId = String(userService.id);
      const service = await must(
        admin
          .from("services")
          .select("slug")
          .eq("id", userService.service_id)
          .single(),
        "load service slug"
      );
      if (!service) {
        throw new Error("Service row is missing after lookup.");
      }
      activityKey = String(service.slug).trim().toLowerCase();
      if (!activityKey) throw new Error("Service activity key is missing.");

      const identity = await must(
        admin
          .from("economic_identities")
          .select("id")
          .eq("account_id", accountId)
          .single(),
        "load economic identity"
      );
      if (!identity) {
        throw new Error("Economic identity row is missing after lookup.");
      }
      economicIdentityId = String(identity.id);

      stripeAccountId = `acct_cert_${accountId.replaceAll("-", "").slice(0, 20)}`;

      await must(
        admin
          .from("economic_stripe_account_projections")
          .delete()
          .eq("economic_identity_id", economicIdentityId),
        "clear prior Stripe projection"
      );

      await must(
        admin
          .from("account_stripe_connect_identities")
          .delete()
          .eq("account_id", accountId),
        "clear prior canonical Stripe identity"
      );

      await must(
        admin
          .from("economic_legal_entities")
          .delete()
          .eq("economic_identity_id", economicIdentityId),
        "clear prior legal subjects"
      );

      const legalEntity = await must(
        admin
          .from("economic_legal_entities")
          .insert({
            economic_identity_id: economicIdentityId,
            entity_type: "individual",
            is_primary: true,
            legal_name: "KLYX Certification Subject",
            country_code: jurisdictionCode,
            source: "account",
            verification_status: "verified",
            verified_at: nowIso(),
          })
          .select("id")
          .single(),
        "create primary legal entity"
      );
      if (!legalEntity) {
        throw new Error("Primary legal entity row is missing after insert.");
      }
      legalEntityId = String(legalEntity.id);

      const person = await must(
        admin
          .from("economic_persons")
          .insert({
            economic_identity_id: economicIdentityId,
            legal_entity_id: legalEntityId,
            relationship: "self",
            is_primary: true,
            source: "account",
            verification_status: "verified",
            verified_at: nowIso(),
          })
          .select("id")
          .single(),
        "create primary economic person"
      );
      if (!person) {
        throw new Error("Primary economic person row is missing after insert.");
      }
      economicPersonId = String(person.id);

      const verification = await must(
        admin
          .from("economic_verification_cases")
          .insert({
            economic_identity_id: economicIdentityId,
            legal_entity_id: legalEntityId,
            economic_person_id: economicPersonId,
            verification_type: "kyc",
            provider: "klyx_certification",
            external_reference: `cert-${randomUUID()}`,
            requirement_key: "settlement_identity",
            status: "verified",
            decision_source: "deterministic_rule",
            human_review_required: false,
            verified_at: nowIso(),
            expires_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            provider_observed_at: nowIso(),
          })
          .select("id")
          .single(),
        "create KYC/KYB verification case"
      );
      if (!verification) {
        throw new Error("Verification case row is missing after insert.");
      }
      verificationCaseId = String(verification.id);

      await resetBaseline();
    });

    it("verified -> allowed", async () => {
      const result = await runCase({ name: "verified" });
      expect(result.decision).toBe("allowed");
      expect(result.reasonCodes).toEqual([]);
    });

    it("pending -> blocked", async () => {
      const result = await runCase({
        name: "pending",
        prepare: async () => {
          await must(
            admin
              .from("economic_verification_cases")
              .update({
                status: "pending",
                verified_at: null,
                updated_at: nowIso(),
              })
              .eq("id", verificationCaseId),
            "set pending verification"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain(
        "ECONOMIC_VERIFICATION_NOT_SATISFIED"
      );
    });

    it("expired -> blocked", async () => {
      const result = await runCase({
        name: "expired",
        prepare: async () => {
          await must(
            admin
              .from("economic_verification_cases")
              .update({
                status: "expired",
                verified_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                updated_at: nowIso(),
              })
              .eq("id", verificationCaseId),
            "set expired verification"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain(
        "ECONOMIC_VERIFICATION_NOT_SATISFIED"
      );
    });

    it("restricted -> blocked", async () => {
      const result = await runCase({
        name: "restricted",
        prepare: async () => {
          await must(
            admin
              .from("economic_verification_cases")
              .update({
                status: "restricted",
                updated_at: nowIso(),
              })
              .eq("id", verificationCaseId),
            "set restricted verification"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain(
        "ECONOMIC_VERIFICATION_NOT_SATISFIED"
      );
    });

    it("qualification_missing -> blocked", async () => {
      const result = await runCase({
        name: "qualification-missing",
        prepare: async () => {
          await must(
            admin
              .from("account_capability_qualifications")
              .delete()
              .eq("account_id", accountId)
              .eq("capability", "offer_services")
              .eq("qualification_key", "real_conditions_certification"),
            "remove required qualification"
          );
        },
        trust: {
          decision: "eligible_with_conditions",
          requiredActions: [
            {
              code: "QUALIFICATION_REQUIRED",
              detail: activityKey,
            },
          ],
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain("ACCOUNT_QUALIFICATION_MISSING");
    });

    it("country_restricted -> blocked", async () => {
      const result = await runCase({
        name: "country-restricted",
        prepare: async () => {
          await must(
            admin.from("economic_restrictions").insert({
              economic_identity_id: economicIdentityId,
              restricted_action: "receive_settlement",
              scope_type: "jurisdiction",
              jurisdiction_code: jurisdictionCode,
              status: "active",
              source: "deterministic_rule",
              reason_code: "certification_country_restricted",
              human_review_required: false,
              starts_at: nowIso(),
            }),
            "create country restriction"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain("ECONOMIC_COUNTRY_RESTRICTED");
    });

    it("Stripe payouts disabled remains payout-rail evidence when recipient transfers are active", async () => {
      const result = await runCase({
        name: "stripe-payouts-disabled",
        prepare: async () => {
          await must(
            admin
              .from("economic_stripe_account_projections")
              .update({
                payouts_enabled: false,
                updated_at: nowIso(),
              })
              .eq("economic_identity_id", economicIdentityId),
            "disable legacy Stripe payouts flag"
          );
        },
      });
      expect(result.decision).toBe("allowed");
      expect(result.reasonCodes).not.toContain("STRIPE_PAYOUTS_NOT_ENABLED");
    });

    it("Stripe transfer capability inactive -> blocked", async () => {
      const result = await runCase({
        name: "stripe-transfer-inactive",
        prepare: async () => {
          await must(
            admin
              .from("economic_stripe_account_projections")
              .update({
                capabilities: { transfers: "inactive" },
                updated_at: nowIso(),
              })
              .eq("economic_identity_id", economicIdentityId),
            "disable Stripe recipient transfer capability"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain(
        "STRIPE_TRANSFER_CAPABILITY_INACTIVE"
      );
    });

    it("Stripe transfer requirements due -> blocked", async () => {
      const result = await runCase({
        name: "stripe-requirements-due",
        prepare: async () => {
          await must(
            admin
              .from("economic_stripe_account_projections")
              .update({
                currently_due: ["recipient.stripe_transfers.requirement"],
                capabilities: { transfers: "pending" },
                updated_at: nowIso(),
              })
              .eq("economic_identity_id", economicIdentityId),
            "set Stripe transfer requirements due"
          );
        },
      });
      expect(result.decision).toBe("blocked");
      expect(result.reasonCodes).toContain(
        "STRIPE_REQUIREMENTS_CURRENTLY_DUE"
      );
      expect(result.reasonCodes).toContain(
        "STRIPE_TRANSFER_CAPABILITY_INACTIVE"
      );
    });

    it("human_review -> human_review", async () => {
      const result = await runCase({
        name: "human-review",
        prepare: async () => {
          await must(
            admin
              .from("economic_verification_cases")
              .update({
                status: "human_review",
                human_review_required: true,
                updated_at: nowIso(),
              })
              .eq("id", verificationCaseId),
            "set verification human review"
          );
        },
      });
      expect(result.decision).toBe("human_review");
      expect(result.reasonCodes).toContain(
        "ECONOMIC_VERIFICATION_HUMAN_REVIEW_REQUIRED"
      );
    });
  }
);

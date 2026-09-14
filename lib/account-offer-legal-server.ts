import "server-only";

import type {
  OfferActivityFrequency,
  OfferLegalDraft,
  OfferLegalPathwayIntent,
} from "@/lib/account-offer-readiness";
import { supabaseAdmin } from "@/lib/supabase-admin";

type WorkContextRow = {
  id: string;
  account_id: string;
  jurisdiction_code: string;
  declared_pathway_intent: OfferLegalPathwayIntent;
  declared_activity_frequency: OfferActivityFrequency;
  declared_facts: Record<string, unknown> | null;
};

export type AccountOfferLegalContext = {
  jurisdictionCode: string;
  pathwayIntent: OfferLegalPathwayIntent;
  activityFrequency: OfferActivityFrequency;
  explicitUncertainty: boolean;
  intakeComplete: boolean;
  missingFields: Array<"pathway" | "frequency">;
};

function validJurisdiction(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}(?:-[A-Z0-9]{2,8})?$/.test(normalized)) {
    throw new Error("KLYX_OFFER_LEGAL_JURISDICTION_INVALID");
  }
  return normalized;
}

function legalContextFromRow(
  jurisdictionCode: string,
  row: WorkContextRow | null
): AccountOfferLegalContext {
  const pathwayIntent = row?.declared_pathway_intent ?? "unknown";
  const activityFrequency = row?.declared_activity_frequency ?? "unknown";
  const facts = row?.declared_facts ?? {};
  const explicitUncertainty = facts.legal_uncertain === true;
  const missingFields: Array<"pathway" | "frequency"> = [];

  if (!explicitUncertainty && pathwayIntent === "unknown") {
    missingFields.push("pathway");
  }
  if (!explicitUncertainty && activityFrequency === "unknown") {
    missingFields.push("frequency");
  }

  return {
    jurisdictionCode,
    pathwayIntent,
    activityFrequency,
    explicitUncertainty,
    intakeComplete: explicitUncertainty || missingFields.length === 0,
    missingFields,
  };
}

async function loadExactWorkContext(
  accountId: string,
  jurisdictionCode: string
): Promise<WorkContextRow | null> {
  const { data, error } = await supabaseAdmin
    .from("trust_work_contexts")
    .select(
      "id, account_id, jurisdiction_code, declared_pathway_intent, declared_activity_frequency, declared_facts"
    )
    .eq("account_id", accountId)
    .eq("jurisdiction_code", jurisdictionCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WorkContextRow | null;
}

export async function loadAccountOfferLegalContext(params: {
  accountId: string;
  jurisdictionCode: string;
}): Promise<AccountOfferLegalContext> {
  const jurisdictionCode = validJurisdiction(params.jurisdictionCode);
  const exact = await loadExactWorkContext(params.accountId, jurisdictionCode);

  if (exact) return legalContextFromRow(jurisdictionCode, exact);

  // Belgian declarations recorded at country scope remain reusable when the
  // activity later resolves to a region. Regional facts, when present, always
  // win. This is reuse of user declarations, never legal classification.
  if (jurisdictionCode.startsWith("BE-")) {
    const country = await loadExactWorkContext(params.accountId, "BE");
    if (country) return legalContextFromRow(jurisdictionCode, country);
  }

  return legalContextFromRow(jurisdictionCode, null);
}

export async function recordAccountOfferLegalDeclaration(params: {
  accountId: string;
  jurisdictionCode: string;
  draft: OfferLegalDraft;
}): Promise<AccountOfferLegalContext> {
  const jurisdictionCode = validJurisdiction(params.jurisdictionCode);
  const existing = await loadExactWorkContext(params.accountId, jurisdictionCode);
  const existingFacts = existing?.declared_facts ?? {};
  const pathwayIntent =
    params.draft.pathwayIntent ?? existing?.declared_pathway_intent ?? "unknown";
  const activityFrequency =
    params.draft.activityFrequency ??
    existing?.declared_activity_frequency ??
    "unknown";
  const declaredFacts = {
    ...existingFacts,
    legal_uncertain: params.draft.explicitUncertainty,
    intake_source: "assistant_offer_activation",
  };

  const { error } = await supabaseAdmin
    .from("trust_work_contexts")
    .upsert(
      {
        account_id: params.accountId,
        jurisdiction_code: jurisdictionCode,
        declared_pathway_intent: pathwayIntent,
        declared_activity_frequency: activityFrequency,
        declared_facts: declaredFacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,jurisdiction_code" }
    );

  if (error) throw new Error(error.message);

  return legalContextFromRow(jurisdictionCode, {
    id: existing?.id ?? "",
    account_id: params.accountId,
    jurisdiction_code: jurisdictionCode,
    declared_pathway_intent: pathwayIntent,
    declared_activity_frequency: activityFrequency,
    declared_facts: declaredFacts,
  });
}

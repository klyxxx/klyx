import { NextResponse } from "next/server";

import { GET as providerSearchCore } from "@/app/api/search/providers/providers-route-core";
import { secureApiErrorResponse } from "@/lib/api-error";
import { apiErrorStatus, getAuthenticatedAccount } from "@/lib/api-auth";
import { isPastBookingStart } from "@/lib/brussels-time";
import type { AgentStep } from "@/lib/client-agent";
import {
  buildPostBookingIncidentMessage,
  evaluatePostBookingIncidentPolicy,
  incidentAllowedForRole,
  isPostBookingIncidentType,
  type PostBookingIncidentPolicyDecision,
  type PostBookingIncidentType,
  type PostBookingReporterRole,
} from "@/lib/post-booking-incidents";
import type {
  ProviderSearchItem,
  ProviderSearchResponse,
} from "@/lib/provider-search";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ROUTE = "/api/bookings/incidents";

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  service_id: string | null;
  quote_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  refund_status: string | null;
  pricing_type_snapshot: string | null;
  unit_price_cents: number | null;
  amount_total: number | null;
  currency: string | null;
};

type ProfileOwnerRow = {
  id: string;
  owner_user_id: string;
};

type IncidentRow = {
  id: string;
  booking_id: string;
  account_id: string;
  subject_account_id: string | null;
  reporter_profile_id: string | null;
  incident_type: PostBookingIncidentType;
  status: string;
  reason: string;
  evidence: Record<string, unknown>;
  policy_version: string;
  policy_snapshot: Record<string, unknown>;
  human_review_required: boolean;
  refund_handling: string;
  replacement_plan_id: string | null;
  replacement_candidate_count: number;
  replacement_search_status: string;
  replacement_search_attempt: number;
  trust_case_id: string | null;
  legacy_dispute_id: string | null;
  created_at: string;
  updated_at: string;
};

type BookingContext = {
  booking: BookingRow;
  reporterRole: PostBookingReporterRole;
  reporterProfileId: string;
  subjectProfileId: string | null;
  subjectAccountId: string | null;
  providerProfileId: string | null;
  serviceSlug: string | null;
  serviceName: string | null;
  city: string | null;
};

type ReplacementCandidate = {
  profileId: string;
  userServiceId: string;
  serviceSlug: string;
  serviceLabel: string;
  firstName: string;
  businessName: string;
  title: string;
  pricingType: ProviderSearchItem["pricingType"];
  price: number | null;
  city: string;
  klyxScore: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isExactMatch: boolean;
  availabilitySummary: string;
};

function cleanEvidence(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = value as Record<string, unknown>;
  return JSON.stringify(normalized).length <= 8000 ? normalized : {};
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function durationHours(start: string, end: string): number {
  const minutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 1;
  }
  return Math.max(0.25, (endMinutes - startMinutes) / 60);
}

function publicCandidate(provider: ProviderSearchItem): ReplacementCandidate {
  return {
    profileId: provider.profileId,
    userServiceId: provider.userServiceId,
    serviceSlug: provider.serviceSlug,
    serviceLabel: provider.serviceLabel,
    firstName: provider.firstName,
    businessName: provider.businessName,
    title: provider.title,
    pricingType: provider.pricingType,
    price: provider.price,
    city: provider.city,
    klyxScore: provider.klyxScore,
    rating: provider.rating,
    reviewCount: provider.reviewCount,
    isVerified: provider.isVerified,
    isExactMatch: provider.isExactMatch,
    availabilitySummary: provider.availabilitySummary,
  };
}

function replacementSearchRequest(context: BookingContext): Request | null {
  if (!context.serviceSlug || !context.city) return null;

  const params = new URLSearchParams({
    service: context.serviceSlug,
    city: context.city,
    date: context.booking.booking_date,
    start: context.booking.start_time.slice(0, 5),
    end: context.booking.end_time.slice(0, 5),
    sort: "recommended",
  });

  if (
    context.booking.pricing_type_snapshot === "hourly" ||
    context.booking.pricing_type_snapshot === "fixed"
  ) {
    params.set("pricing", context.booking.pricing_type_snapshot);
  }

  if (
    context.booking.unit_price_cents != null &&
    context.booking.unit_price_cents >= 0
  ) {
    params.set("budget", String(context.booking.unit_price_cents / 100));
  }

  return new Request(
    `http://klyx.local/api/search/providers?${params.toString()}`,
    { method: "GET" }
  );
}

function replacementSteps(candidateCount: number): AgentStep[] {
  return [
    {
      id: "understand",
      title: "Comprendre l’incident",
      description: "KLYX a relié l’incident à la réservation existante.",
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
    },
    {
      id: "complete",
      title: "Réutiliser le contexte",
      description: "Le service, le créneau et la zone viennent de la réservation.",
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
    },
    {
      id: "search",
      title: "Chercher un remplacement",
      description: `${candidateCount} remplaçant${candidateCount > 1 ? "s" : ""} exact${candidateCount > 1 ? "s" : ""} trouvé${candidateCount > 1 ? "s" : ""}.`,
      status: "completed",
      actionHref: null,
      requiresConfirmation: false,
    },
    {
      id: "choose",
      title: "Présenter le meilleur remplaçant",
      description: "KLYX attend ton accord avant de sélectionner un remplaçant.",
      status: "ready",
      actionHref: null,
      requiresConfirmation: true,
    },
    {
      id: "book",
      title: "Confirmer une nouvelle réservation",
      description: "Aucune nouvelle réservation n’est créée sans confirmation explicite.",
      status: "pending",
      actionHref: null,
      requiresConfirmation: true,
    },
    {
      id: "pay",
      title: "Confirmer tout paiement",
      description: "Aucun débit supplémentaire n’est déclenché automatiquement.",
      status: "pending",
      actionHref: null,
      requiresConfirmation: true,
    },
  ];
}

async function loadBookingContext(params: {
  bookingId: string;
  authUserId: string;
}): Promise<BookingContext | null> {
  const { data: bookingData, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, parent_id, provider_id, babysitter_id, service_id, quote_id, booking_date, start_time, end_time, status, payment_status, refund_status, pricing_type_snapshot, unit_price_cents, amount_total, currency"
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!bookingData) return null;

  const booking = bookingData as BookingRow;
  const providerProfileId = booking.provider_id ?? booking.babysitter_id;
  const participantProfileIds = unique([booking.parent_id, providerProfileId]);
  const { data: owners, error: ownersError } = await supabaseAdmin
    .from("profiles")
    .select("id, owner_user_id")
    .in("id", participantProfileIds);
  if (ownersError) throw new Error(ownersError.message);

  const ownership = new Map(
    ((owners ?? []) as ProfileOwnerRow[]).map((row) => [row.id, row.owner_user_id])
  );
  const clientOwned = ownership.get(booking.parent_id) === params.authUserId;
  const providerOwned =
    Boolean(providerProfileId) &&
    ownership.get(providerProfileId as string) === params.authUserId;

  if (clientOwned === providerOwned) {
    throw new Error(
      clientOwned
        ? "KLYX_INCIDENT_PARTICIPANT_AMBIGUOUS"
        : "KLYX_INCIDENT_ACCESS_DENIED"
    );
  }

  const reporterRole: PostBookingReporterRole = clientOwned ? "client" : "provider";
  const reporterProfileId = clientOwned
    ? booking.parent_id
    : (providerProfileId as string);
  const subjectProfileId = clientOwned ? providerProfileId : booking.parent_id;
  const subjectOwnerUserId = subjectProfileId
    ? ownership.get(subjectProfileId) ?? null
    : null;

  let subjectAccountId: string | null = null;
  if (subjectOwnerUserId) {
    const { data: subjectAccount, error: subjectAccountError } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("auth_user_id", subjectOwnerUserId)
      .maybeSingle();
    if (subjectAccountError) throw new Error(subjectAccountError.message);
    subjectAccountId = subjectAccount?.id ?? null;
  }

  let serviceSlug: string | null = null;
  let serviceName: string | null = null;
  if (booking.service_id) {
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("slug, name")
      .eq("id", booking.service_id)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    serviceSlug = service?.slug ?? null;
    serviceName = service?.name ?? null;
  }

  let city: string | null = null;
  if (booking.quote_id) {
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("service_quotes")
      .select("market_request_id")
      .eq("id", booking.quote_id)
      .maybeSingle();
    if (quoteError) throw new Error(quoteError.message);

    if (quote?.market_request_id) {
      const { data: marketRequest, error: requestError } = await supabaseAdmin
        .from("market_service_requests")
        .select("city")
        .eq("id", quote.market_request_id)
        .maybeSingle();
      if (requestError) throw new Error(requestError.message);
      city = marketRequest?.city ?? null;
    }
  }

  return {
    booking,
    reporterRole,
    reporterProfileId,
    subjectProfileId,
    subjectAccountId,
    providerProfileId,
    serviceSlug,
    serviceName,
    city,
  };
}

async function writeIncidentEvent(params: {
  incidentId: string;
  accountId: string;
  authUserId: string;
  eventType: string;
  eventKey: string;
  reasonCode?: string | null;
  payload?: Record<string, unknown>;
  actorType?: "system" | "account" | "reviewer";
}) {
  const { error } = await supabaseAdmin.from("booking_incident_events").upsert(
    {
      incident_id: params.incidentId,
      actor_type: params.actorType ?? "system",
      actor_account_id: params.accountId,
      actor_auth_user_id: params.authUserId,
      event_type: params.eventType,
      event_key: params.eventKey,
      reason_code: params.reasonCode ?? null,
      payload: params.payload ?? {},
    },
    { onConflict: "event_key", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

async function loadIncident(
  incidentId: string,
  accountId: string
): Promise<IncidentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("booking_incidents")
    .select(
      "id, booking_id, account_id, subject_account_id, reporter_profile_id, incident_type, status, reason, evidence, policy_version, policy_snapshot, human_review_required, refund_handling, replacement_plan_id, replacement_candidate_count, replacement_search_status, replacement_search_attempt, trust_case_id, legacy_dispute_id, created_at, updated_at"
    )
    .eq("id", incidentId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IncidentRow | null) ?? null;
}

async function getOrCreateIncident(params: {
  accountId: string;
  subjectAccountId: string | null;
  reporterProfileId: string;
  bookingId: string;
  incidentType: PostBookingIncidentType;
  reason: string;
  evidence: Record<string, unknown>;
  decision: PostBookingIncidentPolicyDecision;
}): Promise<IncidentRow> {
  const activeStatuses = [
    "open",
    "replacement_ready",
    "human_review",
    "action_required",
  ];

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("booking_incidents")
    .select("id")
    .eq("booking_id", params.bookingId)
    .eq("account_id", params.accountId)
    .eq("incident_type", params.incidentType)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const persisted = await loadIncident(existing.id, params.accountId);
    if (!persisted) throw new Error("KLYX_INCIDENT_NOT_FOUND");
    return persisted;
  }

  const initialStatus = params.decision.humanReviewRequired
    ? "human_review"
    : "open";
  const { data, error } = await supabaseAdmin
    .from("booking_incidents")
    .insert({
      booking_id: params.bookingId,
      account_id: params.accountId,
      subject_account_id: params.subjectAccountId,
      reporter_profile_id: params.reporterProfileId,
      incident_type: params.incidentType,
      status: initialStatus,
      reason: params.reason,
      evidence: params.evidence,
      policy_version: params.decision.policyVersion,
      policy_snapshot: params.decision,
      human_review_required: params.decision.humanReviewRequired,
      refund_handling: params.decision.refundHandling,
    })
    .select(
      "id, booking_id, account_id, subject_account_id, reporter_profile_id, incident_type, status, reason, evidence, policy_version, policy_snapshot, human_review_required, refund_handling, replacement_plan_id, replacement_candidate_count, replacement_search_status, replacement_search_attempt, trust_case_id, legacy_dispute_id, created_at, updated_at"
    )
    .single();

  if (error?.code === "23505") {
    const { data: raced, error: racedError } = await supabaseAdmin
      .from("booking_incidents")
      .select("id")
      .eq("booking_id", params.bookingId)
      .eq("account_id", params.accountId)
      .eq("incident_type", params.incidentType)
      .in("status", activeStatuses)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (racedError) throw new Error(racedError.message);
    if (raced?.id) {
      const persisted = await loadIncident(raced.id, params.accountId);
      if (persisted) return persisted;
    }
  }

  if (error) throw new Error(error.message);
  return data as IncidentRow;
}

async function ensureLegacyDispute(params: {
  incident: IncidentRow;
  context: BookingContext;
}): Promise<string | null> {
  if (params.incident.incident_type !== "dispute") {
    return params.incident.legacy_dispute_id;
  }
  if (params.incident.legacy_dispute_id) return params.incident.legacy_dispute_id;
  if (!params.context.subjectProfileId) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("disputes")
    .select("id")
    .eq("booking_id", params.context.booking.id)
    .eq("opened_by", params.context.reporterProfileId)
    .in("status", ["open", "under_review", "waiting_user"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let disputeId = existing?.id ?? null;
  if (!disputeId) {
    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from("disputes")
      .insert({
        booking_id: params.context.booking.id,
        opened_by: params.context.reporterProfileId,
        against_profile_id: params.context.subjectProfileId,
        reason: "other",
        description: params.incident.reason,
        priority: "normal",
        status: "open",
      })
      .select("id")
      .single();
    if (disputeError) throw new Error(disputeError.message);
    disputeId = dispute.id;

    const { error: eventError } = await supabaseAdmin.from("dispute_events").insert({
      dispute_id: disputeId,
      actor_id: params.context.reporterProfileId,
      event_type: "opened",
      note: params.incident.reason,
    });
    if (eventError) throw new Error(eventError.message);
  }

  const { error: linkError } = await supabaseAdmin
    .from("booking_incidents")
    .update({ legacy_dispute_id: disputeId, updated_at: new Date().toISOString() })
    .eq("id", params.incident.id)
    .is("legacy_dispute_id", null);
  if (linkError) throw new Error(linkError.message);

  return disputeId;
}

async function ensureTrustCase(params: {
  incident: IncidentRow;
  context: BookingContext;
  decision: PostBookingIncidentPolicyDecision;
  accountId: string;
  authUserId: string;
  legacyDisputeId: string | null;
}): Promise<string | null> {
  if (!params.decision.humanReviewRequired || !params.decision.trustCaseType) {
    return params.incident.trust_case_id;
  }
  if (params.incident.trust_case_id) return params.incident.trust_case_id;

  const details = {
    origin: "post_booking_incident",
    incident_id: params.incident.id,
    incident_type: params.incident.incident_type,
    policy_version: params.decision.policyVersion,
    llm_decision: false,
    automatic_sanction: false,
  };

  let trustCaseId: string | null = null;
  const { data: trustCase, error: trustCaseError } = await supabaseAdmin
    .from("trust_cases")
    .insert({
      case_type: params.decision.trustCaseType,
      subject_account_id: params.context.subjectAccountId,
      reporter_account_id: params.accountId,
      booking_id: params.context.booking.id,
      legacy_dispute_id: params.legacyDisputeId,
      source: "user",
      severity: params.decision.trustSeverity,
      status: "triage",
      reason_code: params.decision.reasonCode,
      summary: params.incident.reason.slice(0, 1000),
      details,
    })
    .select("id")
    .single();

  if (trustCaseError?.code === "23505") {
    const { data: raced, error: racedError } = await supabaseAdmin
      .from("trust_cases")
      .select("id")
      .contains("details", {
        origin: "post_booking_incident",
        incident_id: params.incident.id,
      })
      .maybeSingle();
    if (racedError) throw new Error(racedError.message);
    trustCaseId = raced?.id ?? null;
  } else if (trustCaseError) {
    throw new Error(trustCaseError.message);
  } else {
    trustCaseId = trustCase.id;
  }

  if (!trustCaseId) throw new Error("KLYX_INCIDENT_TRUST_CASE_CREATE_FAILED");

  const { error: trustEventsError } = await supabaseAdmin
    .from("trust_case_events")
    .insert([
      {
        case_id: trustCaseId,
        actor_type: "account",
        actor_account_id: params.accountId,
        actor_auth_user_id: params.authUserId,
        event_type: "opened",
        reason_code: params.decision.reasonCode,
        payload: { incidentId: params.incident.id },
      },
      {
        case_id: trustCaseId,
        actor_type: "system",
        event_type: "review_requested",
        reason_code: params.decision.reasonCode,
        payload: {
          incidentId: params.incident.id,
          policyVersion: params.decision.policyVersion,
          llmDecision: false,
        },
      },
    ]);
  if (trustEventsError?.code !== "23505" && trustEventsError) {
    throw new Error(trustEventsError.message);
  }

  const { error: linkError } = await supabaseAdmin
    .from("booking_incidents")
    .update({ trust_case_id: trustCaseId, status: "human_review", updated_at: new Date().toISOString() })
    .eq("id", params.incident.id)
    .is("trust_case_id", null);
  if (linkError) throw new Error(linkError.message);

  return trustCaseId;
}

async function runReplacementSearch(params: {
  incident: IncidentRow;
  context: BookingContext;
  accountId: string;
  authUserId: string;
}): Promise<{ planId: string | null; candidates: ReplacementCandidate[]; busy: boolean }> {
  if (params.incident.replacement_plan_id) {
    const { data: plan, error: planError } = await supabaseAdmin
      .from("client_agent_plans")
      .select("search_snapshot")
      .eq("id", params.incident.replacement_plan_id)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    return {
      planId: params.incident.replacement_plan_id,
      candidates: Array.isArray(plan?.search_snapshot)
        ? (plan.search_snapshot as ReplacementCandidate[])
        : [],
      busy: false,
    };
  }

  if (params.context.reporterRole !== "client") {
    return { planId: null, candidates: [], busy: false };
  }

  const nextAttempt = params.incident.replacement_search_attempt + 1;
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("booking_incidents")
    .update({
      replacement_search_status: "running",
      replacement_search_attempt: nextAttempt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.incident.id)
    .in("replacement_search_status", ["idle", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);

  if (!claimed) {
    const refreshed = await loadIncident(params.incident.id, params.accountId);
    if (refreshed?.replacement_plan_id) {
      return runReplacementSearch({
        ...params,
        incident: refreshed,
      });
    }
    return { planId: null, candidates: [], busy: true };
  }

  await writeIncidentEvent({
    incidentId: params.incident.id,
    accountId: params.accountId,
    authUserId: params.authUserId,
    eventType: "replacement_search_started",
    eventKey: `incident:${params.incident.id}:replacement-search:${nextAttempt}`,
    payload: { attempt: nextAttempt, orchestration: "providerSearchCore" },
  });

  try {
    const searchRequest = replacementSearchRequest(params.context);
    if (!searchRequest) {
      await supabaseAdmin
        .from("booking_incidents")
        .update({
          replacement_search_status: "failed",
          replacement_candidate_count: 0,
          status: params.incident.human_review_required ? "human_review" : "action_required",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.incident.id);
      await writeIncidentEvent({
        incidentId: params.incident.id,
        accountId: params.accountId,
        authUserId: params.authUserId,
        eventType: "replacement_candidates_ready",
        eventKey: `incident:${params.incident.id}:replacement-result:${nextAttempt}`,
        reasonCode: "replacement_context_incomplete",
        payload: { candidateCount: 0 },
      });
      return { planId: null, candidates: [], busy: false };
    }

    const response = await providerSearchCore(searchRequest);
    const payload = (await response.json()) as ProviderSearchResponse & { error?: string };
    if (!response.ok) throw new Error("KLYX_INCIDENT_REPLACEMENT_SEARCH_FAILED");

    const providers = Array.isArray(payload.providers) ? payload.providers : [];
    const candidates = providers
      .filter(
        (provider) =>
          provider.isExactMatch &&
          provider.profileId !== params.context.providerProfileId
      )
      .slice(0, 5)
      .map(publicCandidate);

    let planId: string | null = null;
    if (candidates.length > 0 && params.context.serviceSlug) {
      const now = new Date().toISOString();
      const { data: plan, error: planError } = await supabaseAdmin
        .from("client_agent_plans")
        .insert({
          profile_id: params.context.booking.parent_id,
          title: `Remplacement — ${params.context.serviceName ?? params.context.serviceSlug}`,
          raw_request: `Remplacement demandé après incident sur la réservation ${params.context.booking.id}.`,
          service_slug: params.context.serviceSlug,
          city: params.context.city,
          requested_day: params.context.booking.booking_date,
          requested_time: params.context.booking.start_time.slice(0, 5),
          duration_hours: durationHours(
            params.context.booking.start_time,
            params.context.booking.end_time
          ),
          budget_max:
            params.context.booking.unit_price_cents != null
              ? params.context.booking.unit_price_cents / 100
              : null,
          plan_status: "in_progress",
          steps: replacementSteps(candidates.length),
          memory_used: false,
          search_snapshot: candidates,
          execution_status: "waiting_confirmation",
          execution_revision: 1,
          next_action: "choose",
          next_action_href: null,
          last_execution_code: null,
          last_execution_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (planError) throw new Error(planError.message);
      planId = plan.id;

      const { error: agentEventsError } = await supabaseAdmin
        .from("client_agent_plan_events")
        .insert([
          {
            plan_id: planId,
            profile_id: params.context.booking.parent_id,
            execution_revision: 1,
            event_type: "search_started",
            step_id: "search",
            payload: {
              source: "post_booking_incident",
              incidentId: params.incident.id,
            },
          },
          {
            plan_id: planId,
            profile_id: params.context.booking.parent_id,
            execution_revision: 1,
            event_type: "search_succeeded",
            step_id: "search",
            payload: {
              exactReplacementCount: candidates.length,
              excludedOriginalProviderId: params.context.providerProfileId,
            },
          },
          {
            plan_id: planId,
            profile_id: params.context.booking.parent_id,
            execution_revision: 1,
            event_type: "confirmation_required",
            step_id: "choose",
            payload: {
              reason: "replacement_requires_explicit_consent",
              incidentId: params.incident.id,
            },
          },
        ]);
      if (agentEventsError) throw new Error(agentEventsError.message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("booking_incidents")
      .update({
        replacement_plan_id: planId,
        replacement_candidate_count: candidates.length,
        replacement_search_status: candidates.length > 0 ? "ready" : "failed",
        status:
          candidates.length > 0
            ? "replacement_ready"
            : params.incident.human_review_required
              ? "human_review"
              : "action_required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.incident.id)
      .eq("replacement_search_attempt", nextAttempt);
    if (updateError) throw new Error(updateError.message);

    await writeIncidentEvent({
      incidentId: params.incident.id,
      accountId: params.accountId,
      authUserId: params.authUserId,
      eventType: "replacement_candidates_ready",
      eventKey: `incident:${params.incident.id}:replacement-result:${nextAttempt}`,
      payload: {
        candidateCount: candidates.length,
        planId,
        automaticReplacement: false,
      },
    });

    return { planId, candidates, busy: false };
  } catch (error) {
    await supabaseAdmin
      .from("booking_incidents")
      .update({
        replacement_search_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.incident.id)
      .eq("replacement_search_attempt", nextAttempt);
    throw error;
  }
}

function errorResponse(error: unknown, startedAt: number) {
  const message = error instanceof Error ? error.message : "Incident indisponible.";
  if (message === "KLYX_INCIDENT_ACCESS_DENIED") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (message === "KLYX_INCIDENT_PARTICIPANT_AMBIGUOUS") {
    return NextResponse.json(
      { error: "Cette réservation ne permet pas d’identifier le participant de façon sûre." },
      { status: 409 }
    );
  }

  const status = apiErrorStatus(message);
  return secureApiErrorResponse({
    error,
    event: "post_booking_incident_failed",
    route: ROUTE,
    method: "POST",
    status,
    code: "KLYX_POST_BOOKING_INCIDENT_FAILED",
    publicMessage: status < 500 ? message : undefined,
    startedAt,
  });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await getAuthenticatedAccount(request);
    const { data, error } = await supabaseAdmin
      .from("booking_incidents")
      .select(
        "id, booking_id, incident_type, status, reason, human_review_required, refund_handling, replacement_plan_id, replacement_candidate_count, trust_case_id, legacy_dispute_id, created_at, updated_at"
      )
      .eq("account_id", auth.account.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ incidents: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = apiErrorStatus(message);
    return secureApiErrorResponse({
      error,
      event: "post_booking_incidents_load_failed",
      route: ROUTE,
      method: "GET",
      status,
      code: "KLYX_POST_BOOKING_INCIDENTS_LOAD_FAILED",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const auth = await getAuthenticatedAccount(request);
    const body = (await request.json()) as {
      bookingId?: unknown;
      incidentType?: unknown;
      reason?: unknown;
      evidence?: unknown;
    };
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";

    if (!bookingId || !isPostBookingIncidentType(body.incidentType)) {
      return NextResponse.json({ error: "Réservation ou incident invalide." }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Décris la raison de l’incident avec au moins 5 caractères." },
        { status: 400 }
      );
    }

    const context = await loadBookingContext({
      bookingId,
      authUserId: auth.user.id,
    });
    if (!context) {
      return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
    }
    if (!incidentAllowedForRole(body.incidentType, context.reporterRole)) {
      return NextResponse.json(
        { error: "Cet incident ne correspond pas à ton rôle dans cette réservation." },
        { status: 409 }
      );
    }

    const decision = evaluatePostBookingIncidentPolicy({
      incidentType: body.incidentType,
      reporterRole: context.reporterRole,
      paymentStatus: context.booking.payment_status,
      afterStart: isPastBookingStart(
        context.booking.booking_date,
        context.booking.start_time
      ),
    });
    const evidence = cleanEvidence(body.evidence);
    let incident = await getOrCreateIncident({
      accountId: auth.account.id,
      subjectAccountId: context.subjectAccountId,
      reporterProfileId: context.reporterProfileId,
      bookingId,
      incidentType: body.incidentType,
      reason,
      evidence,
      decision,
    });

    await writeIncidentEvent({
      incidentId: incident.id,
      accountId: auth.account.id,
      authUserId: auth.user.id,
      eventType: "opened",
      eventKey: `incident:${incident.id}:opened`,
      reasonCode: decision.reasonCode,
      payload: { reason, evidence },
      actorType: "account",
    });
    await writeIncidentEvent({
      incidentId: incident.id,
      accountId: auth.account.id,
      authUserId: auth.user.id,
      eventType: "policy_evaluated",
      eventKey: `incident:${incident.id}:policy:${decision.policyVersion}`,
      reasonCode: decision.reasonCode,
      payload: decision,
    });

    const legacyDisputeId = await ensureLegacyDispute({ incident, context });
    if (legacyDisputeId) {
      await writeIncidentEvent({
        incidentId: incident.id,
        accountId: auth.account.id,
        authUserId: auth.user.id,
        eventType: "linked_dispute",
        eventKey: `incident:${incident.id}:dispute:${legacyDisputeId}`,
        payload: { legacyDisputeId },
      });
    }

    const trustCaseId = await ensureTrustCase({
      incident,
      context,
      decision,
      accountId: auth.account.id,
      authUserId: auth.user.id,
      legacyDisputeId,
    });
    if (trustCaseId) {
      await writeIncidentEvent({
        incidentId: incident.id,
        accountId: auth.account.id,
        authUserId: auth.user.id,
        eventType: "human_review_requested",
        eventKey: `incident:${incident.id}:human-review:${trustCaseId}`,
        reasonCode: decision.reasonCode,
        payload: { trustCaseId, llmVerdict: false, automaticSanction: false },
      });
    }

    if (decision.refundHandling !== "none") {
      await writeIncidentEvent({
        incidentId: incident.id,
        accountId: auth.account.id,
        authUserId: auth.user.id,
        eventType: "refund_policy_reused",
        eventKey: `incident:${incident.id}:refund-policy:${decision.refundHandling}`,
        reasonCode: decision.reasonCode,
        payload: {
          handling: decision.refundHandling,
          paymentStatus: context.booking.payment_status,
          refundStatus: context.booking.refund_status,
          ledger: "booking_financial_ledger",
          createsRefund: false,
          createsCharge: false,
        },
      });
    }

    let replacement = {
      planId: incident.replacement_plan_id,
      candidates: [] as ReplacementCandidate[],
      busy: false,
    };
    if (decision.replacementEligible) {
      replacement = await runReplacementSearch({
        incident,
        context,
        accountId: auth.account.id,
        authUserId: auth.user.id,
      });
    }

    incident = (await loadIncident(incident.id, auth.account.id)) ?? incident;
    const assistantMessage = buildPostBookingIncidentMessage({
      incidentType: body.incidentType,
      replacementCandidateCount:
        replacement.candidates.length || incident.replacement_candidate_count,
      humanReviewRequired: decision.humanReviewRequired,
      refundHandling: decision.refundHandling,
      refundStatus: context.booking.refund_status,
    });

    return NextResponse.json(
      {
        incident: {
          id: incident.id,
          bookingId: incident.booking_id,
          type: incident.incident_type,
          status: incident.status,
          humanReviewRequired: incident.human_review_required,
          trustCaseId: incident.trust_case_id,
          legacyDisputeId: incident.legacy_dispute_id,
        },
        assistant: {
          message: replacement.busy
            ? "La recherche d’un remplaçant est déjà en cours. Aucun remplacement ne sera confirmé sans ton accord."
            : assistantMessage,
          nextAction:
            incident.replacement_candidate_count > 0
              ? "present_best_replacement"
              : decision.humanReviewRequired
                ? "human_review"
                : null,
        },
        replacement: {
          planId: incident.replacement_plan_id,
          compatibleCount: incident.replacement_candidate_count,
          searchStatus: incident.replacement_search_status,
          automaticReplacement: false,
        },
        financial: {
          paymentStatus: context.booking.payment_status,
          refundStatus: context.booking.refund_status,
          refundHandling: decision.refundHandling,
          automaticCharge: false,
          createsParallelLedger: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, startedAt);
  }
}

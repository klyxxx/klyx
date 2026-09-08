import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { apiErrorStatus } from "@/lib/api-auth";
import {
  requireBrainMultiSlotConfirmation,
  type ConfirmedMultiSlot,
} from "@/lib/brain-multi-slot-proof";
import {
  notifyFullCoverageProviders,
  rankProvidersForMultiSlots,
  type MultiSlotCandidate,
} from "@/lib/market-multi-slot";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_MULTI_SLOT_MARKET_PUBLISH_12_83
// KLYX_BRAIN_MULTI_SLOT_ATOMIC_PUBLICATION_20260907

type AtomicPublicationRow = {
  request_id: string;
  created: boolean;
};

function clean(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function minutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function durationMinutes(slot: ConfirmedMultiSlot) {
  const start = minutes(slot.startTime);
  let end = minutes(slot.endTime);

  if (start == null || end == null) {
    return null;
  }

  if (end <= start) {
    end += 1440;
  }

  const duration = end - start;
  return duration > 0 && duration <= 1440
    ? duration
    : null;
}

function totalBudget(slots: ConfirmedMultiSlot[]) {
  if (!slots.every((slot) => slot.budget != null)) {
    return null;
  }

  return (
    Math.round(
      slots.reduce(
        (total, slot) => total + (slot.budget ?? 0),
        0
      ) * 100
    ) / 100
  );
}

async function existingPublishedRequest(
  confirmationId: string,
  profileId: string
) {
  const { data, error } = await supabaseAdmin
    .from("market_service_requests")
    .select("id")
    .eq("brain_confirmation_message_id", confirmationId)
    .eq("client_profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function publicationMessageId(requestId: string) {
  const hex = createHash("sha256")
    .update("klyx:brain:multi-slot-published:" + requestId)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

async function publicationWasCommitted(params: {
  conversationId: string;
  confirmationId: string;
  requestId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("brain_messages")
    .select("id")
    .eq("id", publicationMessageId(params.requestId))
    .eq("conversation_id", params.conversationId)
    .eq("role", "assistant")
    .contains("payload", {
      action: "multi_slot_market_request_published",
      marketRequestId: params.requestId,
      confirmationId: params.confirmationId,
    })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function ensurePublicationMarker(params: {
  conversationId: string;
  confirmationId: string;
  requestId: string;
  slotCount: number;
  fullCoverageCount: number;
}) {
  const messageId = publicationMessageId(params.requestId);

  const { error } = await supabaseAdmin
    .from("brain_messages")
    .insert({
      id: messageId,
      conversation_id: params.conversationId,
      role: "assistant",
      content:
        params.fullCoverageCount > 0
          ? "Demande multi-creneaux publiee. KLYX a trouve des prestataires couvrant tous les creneaux."
          : "Demande multi-creneaux publiee. Aucun prestataire ne couvre encore tous les creneaux.",
      payload: {
        action: "multi_slot_market_request_published",
        marketRequestId: params.requestId,
        confirmationId: params.confirmationId,
        slotCount: params.slotCount,
        fullCoverageCount: params.fullCoverageCount,
        automaticExecutionAllowed: false,
      },
    });

  if (!error) {
    return;
  }

  if (error.code !== "23505") {
    throw new Error(error.message);
  }

  const committed = await publicationWasCommitted({
    conversationId: params.conversationId,
    confirmationId: params.confirmationId,
    requestId: params.requestId,
  });

  if (!committed) {
    throw new Error(
      "KLYX_MULTI_SLOT_PUBLICATION_MARKER_COLLISION"
    );
  }
}

async function loadPersistedCandidates(requestId: string) {
  const { data, error } = await supabaseAdmin
    .from("market_request_provider_candidates")
    .select(
      "provider_profile_id, coverage_count, slot_count, full_coverage"
    )
    .eq("market_request_id", requestId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(
    (item): MultiSlotCandidate => ({
      providerProfileId: item.provider_profile_id,
      coverageCount: item.coverage_count,
      slotCount: item.slot_count,
      fullCoverage: item.full_coverage,
    })
  );
}

async function candidateSnapshotWasPersisted(
  requestId: string,
  expectedSlotCount: number
) {
  const { data, error } = await supabaseAdmin
    .from("market_service_request_slots")
    .select("position")
    .eq("market_request_id", requestId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (data?.length !== expectedSlotCount) {
    return false;
  }

  return data.every(
    (item, index) => Number(item.position) === index + 1
  );
}

function publicationInProgressResponse(requestId: string) {
  return NextResponse.json(
    {
      requestId,
      requestMode: "multi_slot",
      replayed: true,
      inProgress: true,
      automaticExecutionAllowed: false,
      message:
        "Publication KLYX deja en cours pour cette confirmation.",
    },
    { status: 409 }
  );
}

async function replayedResponse(params: {
  requestId: string;
  slotCount: number;
}) {
  const candidates = await loadPersistedCandidates(
    params.requestId
  );
  const fullCoverageCount = candidates.filter(
    (item) => item.fullCoverage
  ).length;

  return NextResponse.json({
    requestId: params.requestId,
    requestMode: "multi_slot",
    slotCount: params.slotCount,
    candidateCount: candidates.length,
    fullCoverageCount,
    preferSingleProvider: true,
    href: "/assistant/market/" + params.requestId,
    replayed: true,
    message:
      "Demande groupee deja publiee avec cette confirmation.",
    automaticExecutionAllowed: false,
  });
}

async function createAtomicPublication(params: {
  profileId: string;
  serviceId: string;
  title: string;
  description: string;
  city: string;
  requestedDate: string;
  requestedTime: string;
  budgetTotal: number | null;
  confirmationId: string;
  slots: Array<{
    position: number;
    requested_date: string;
    start_time: string;
    end_time: string;
    budget_max: number | null;
    duration_minutes: number;
  }>;
  candidates: MultiSlotCandidate[];
}) {
  const { data, error } = await supabaseAdmin.rpc(
    "klyx_create_brain_multi_slot_market_request",
    {
      p_client_profile_id: params.profileId,
      p_service_id: params.serviceId,
      p_title: params.title,
      p_description: params.description,
      p_city: params.city,
      p_requested_date: params.requestedDate,
      p_requested_time: params.requestedTime,
      p_budget_total: params.budgetTotal,
      p_slot_count: params.slots.length,
      p_confirmation_id: params.confirmationId,
      p_slots: params.slots,
      p_candidates: params.candidates.map(
        (candidate) => ({
          provider_profile_id:
            candidate.providerProfileId,
          coverage_count: candidate.coverageCount,
          slot_count: candidate.slotCount,
          full_coverage: candidate.fullCoverage,
        })
      ),
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | AtomicPublicationRow
    | null
    | undefined;

  if (!row?.request_id) {
    throw new Error(
      "Publication KLYX atomique sans identifiant de demande."
    );
  }

  return {
    requestId: row.request_id,
    created: row.created === true,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.clone().json();

    if (body?.confirmed !== true) {
      return NextResponse.json(
        {
          error:
            "La publication exige une confirmation explicite.",
        },
        { status: 400 }
      );
    }

    const proof = await requireBrainMultiSlotConfirmation({
      request,
      body,
    });

    const title = clean(body.title, 120);
    const description = clean(body.description, 2000);

    if (title.length < 3 || description.length < 10) {
      return NextResponse.json(
        { error: "Titre et description requis." },
        { status: 400 }
      );
    }

    const { data: service, error: serviceError } =
      await supabaseAdmin
        .from("services")
        .select("id, name, slug")
        .eq("slug", proof.serviceSlug)
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!service) {
      return NextResponse.json(
        { error: "Service KLYX introuvable." },
        { status: 404 }
      );
    }

    const serviceName = service.name?.trim() || service.slug;
    const durations = proof.slots.map(durationMinutes);

    if (durations.some((value) => value == null)) {
      return NextResponse.json(
        {
          error:
            "Un creneau contient une duree invalide.",
        },
        { status: 400 }
      );
    }

    const budgetTotal = totalBudget(proof.slots);
    const first = proof.slots[0];
    const prior = await existingPublishedRequest(
      proof.confirmationId,
      proof.profileId
    );

    let marketRequestId = prior?.id ?? null;
    let replayed = Boolean(prior);
    let candidates: MultiSlotCandidate[];

    if (marketRequestId) {
      if (
        await publicationWasCommitted({
          conversationId: proof.conversationId,
          confirmationId: proof.confirmationId,
          requestId: marketRequestId,
        })
      ) {
        return replayedResponse({
          requestId: marketRequestId,
          slotCount: proof.slots.length,
        });
      }

      const snapshotReady = await candidateSnapshotWasPersisted(
        marketRequestId,
        proof.slots.length
      );

      // Legacy rows created before the atomic RPC can still be incomplete.
      // Keep those fail-closed instead of mutating a possibly observed parent.
      if (!snapshotReady) {
        return publicationInProgressResponse(marketRequestId);
      }

      candidates = await loadPersistedCandidates(
        marketRequestId
      );
    } else {
      const rankedCandidates = await rankProvidersForMultiSlots({
        serviceId: service.id,
        slots: proof.slots,
      });

      const slotRows = proof.slots.map((slot, index) => ({
        position: index + 1,
        requested_date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        budget_max: slot.budget,
        duration_minutes: durations[index] as number,
      }));

      const atomic = await createAtomicPublication({
        profileId: proof.profileId,
        serviceId: service.id,
        title,
        description,
        city: proof.city,
        requestedDate: first.date,
        requestedTime: first.startTime + ":00",
        budgetTotal,
        confirmationId: proof.confirmationId,
        slots: slotRows,
        candidates: rankedCandidates,
      });

      marketRequestId = atomic.requestId;
      replayed = !atomic.created;

      if (replayed) {
        if (
          await publicationWasCommitted({
            conversationId: proof.conversationId,
            confirmationId: proof.confirmationId,
            requestId: marketRequestId,
          })
        ) {
          return replayedResponse({
            requestId: marketRequestId,
            slotCount: proof.slots.length,
          });
        }

        const snapshotReady = await candidateSnapshotWasPersisted(
          marketRequestId,
          proof.slots.length
        );

        if (!snapshotReady) {
          return publicationInProgressResponse(
            marketRequestId
          );
        }

        // A concurrent caller may have ranked against a slightly different
        // live provider state. Only the winner's committed ranking is durable.
        candidates = await loadPersistedCandidates(
          marketRequestId
        );
      } else {
        candidates = rankedCandidates;
      }
    }

    if (!marketRequestId) {
      throw new Error(
        "Demande KLYX introuvable apres publication."
      );
    }

    const fullCoverageCount = candidates.filter(
      (item) => item.fullCoverage
    ).length;

    await notifyFullCoverageProviders({
      marketRequestId,
      candidates,
      serviceName,
      city: proof.city,
      slotCount: proof.slots.length,
    });

    await ensurePublicationMarker({
      conversationId: proof.conversationId,
      confirmationId: proof.confirmationId,
      requestId: marketRequestId,
      slotCount: proof.slots.length,
      fullCoverageCount,
    });

    return NextResponse.json({
      requestId: marketRequestId,
      requestMode: "multi_slot",
      slotCount: proof.slots.length,
      candidateCount: candidates.length,
      fullCoverageCount,
      preferSingleProvider: true,
      href: "/assistant/market/" + marketRequestId,
      replayed,
      message:
        fullCoverageCount > 0
          ? "Demande groupee publiee. KLYX privilegie les prestataires disponibles sur tous les creneaux."
          : "Demande groupee publiee. KLYX attend un prestataire capable de couvrir tous les creneaux.",
      automaticExecutionAllowed: false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Publication multi-creneaux impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

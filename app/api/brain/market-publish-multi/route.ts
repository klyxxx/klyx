import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
} from "@/lib/api-auth";
import {
  requireBrainMultiSlotConfirmation,
  type ConfirmedMultiSlot,
} from "@/lib/brain-multi-slot-proof";
import {
  notifyFullCoverageProviders,
  rankProvidersForMultiSlots,
  type MultiSlotCandidate,
} from "@/lib/market-multi-slot";

// KLYX_MULTI_SLOT_MARKET_PUBLISH_12_83

function clean(
  value: unknown,
  maximum: number
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maximum
        )
    : "";
}

function minutes(
  value: string
) {
  const match =
    /^(\d{2}):(\d{2})$/.exec(
      value
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) *
      60 +
    Number(match[2])
  );
}

function durationMinutes(
  slot: ConfirmedMultiSlot
) {
  const start =
    minutes(
      slot.startTime
    );

  let end =
    minutes(
      slot.endTime
    );

  if (
    start == null ||
    end == null
  ) {
    return null;
  }

  if (end <= start) {
    end += 1440;
  }

  const duration =
    end - start;

  return (
    duration > 0 &&
    duration <= 1440
      ? duration
      : null
  );
}

function totalBudget(
  slots: ConfirmedMultiSlot[]
) {
  if (
    !slots.every(
      (slot) =>
        slot.budget != null
    )
  ) {
    return null;
  }

  return (
    Math.round(
      slots.reduce(
        (total, slot) =>
          total +
          (
            slot.budget ??
            0
          ),
        0
      ) *
        100
    ) / 100
  );
}

async function existingPublishedRequest(
  confirmationId: string,
  profileId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "market_service_requests"
    )
    .select("id")
    .eq(
      "brain_confirmation_message_id",
      confirmationId
    )
    .eq(
      "client_profile_id",
      profileId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data;
}

function publicationMessageId(
  requestId: string
) {
  const hex =
    createHash("sha256")
      .update(
        "klyx:brain:multi-slot-published:" +
        requestId
      )
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

async function publicationWasCommitted(
  params: {
    conversationId: string;
    confirmationId: string;
    requestId: string;
  }
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "brain_messages"
    )
    .select("id")
    .eq(
      "id",
      publicationMessageId(
        params.requestId
      )
    )
    .eq(
      "conversation_id",
      params.conversationId
    )
    .eq(
      "role",
      "assistant"
    )
    .contains(
      "payload",
      {
        action:
          "multi_slot_market_request_published",
        marketRequestId:
          params.requestId,
        confirmationId:
          params.confirmationId,
      }
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return Boolean(data);
}

async function ensurePublicationMarker(
  params: {
    conversationId: string;
    confirmationId: string;
    requestId: string;
    slotCount: number;
    fullCoverageCount: number;
  }
) {
  const messageId =
    publicationMessageId(
      params.requestId
    );

  const { error } =
    await supabaseAdmin
      .from(
        "brain_messages"
      )
      .insert({
        id: messageId,
        conversation_id:
          params.conversationId,
        role:
          "assistant",
        content:
          params.fullCoverageCount >
          0
            ? "Demande multi-creneaux publiee. KLYX a trouve des prestataires couvrant tous les creneaux."
            : "Demande multi-creneaux publiee. Aucun prestataire ne couvre encore tous les creneaux.",
        payload: {
          action:
            "multi_slot_market_request_published",
          marketRequestId:
            params.requestId,
          confirmationId:
            params.confirmationId,
          slotCount:
            params.slotCount,
          fullCoverageCount:
            params.fullCoverageCount,
          automaticExecutionAllowed:
            false,
        },
      });

  if (!error) {
    return;
  }

  if (error.code !== "23505") {
    throw new Error(
      error.message
    );
  }

  const committed =
    await publicationWasCommitted({
      conversationId:
        params.conversationId,
      confirmationId:
        params.confirmationId,
      requestId:
        params.requestId,
    });

  if (!committed) {
    throw new Error(
      "KLYX_MULTI_SLOT_PUBLICATION_MARKER_COLLISION"
    );
  }
}

async function loadPersistedCandidates(
  requestId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "market_request_provider_candidates"
    )
    .select(
      "provider_profile_id, coverage_count, slot_count, full_coverage"
    )
    .eq(
      "market_request_id",
      requestId
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return (
    data ?? []
  ).map(
    (item): MultiSlotCandidate => ({
      providerProfileId:
        item.provider_profile_id,
      coverageCount:
        item.coverage_count,
      slotCount:
        item.slot_count,
      fullCoverage:
        item.full_coverage,
    })
  );
}

async function candidateSnapshotWasPersisted(
  requestId: string,
  expectedSlotCount: number
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "market_service_request_slots"
    )
    .select("position")
    .eq(
      "market_request_id",
      requestId
    )
    .order(
      "position",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (
    data?.length !==
    expectedSlotCount
  ) {
    return false;
  }

  return data.every(
    (item, index) =>
      Number(
        item.position
      ) ===
      index + 1
  );
}

function publicationInProgressResponse(
  requestId: string
) {
  return NextResponse.json(
    {
      requestId,
      requestMode:
        "multi_slot",
      replayed: true,
      inProgress: true,
      automaticExecutionAllowed:
        false,
      message:
        "Publication KLYX deja en cours pour cette confirmation.",
    },
    {
      status: 409,
    }
  );
}

async function replayedResponse(
  params: {
    requestId: string;
    slotCount: number;
  }
) {
  const candidates =
    await loadPersistedCandidates(
      params.requestId
    );

  const fullCoverageCount =
    candidates.filter(
      (item) =>
        item.fullCoverage
    ).length;

  return NextResponse.json({
    requestId:
      params.requestId,
    requestMode:
      "multi_slot",
    slotCount:
      params.slotCount,
    candidateCount:
      candidates.length,
    fullCoverageCount,
    preferSingleProvider:
      true,
    href:
      "/assistant/market/" +
      params.requestId,
    replayed: true,
    message:
      "Demande groupee deja publiee avec cette confirmation.",
    automaticExecutionAllowed:
      false,
  });
}

export async function POST(
  request: Request
) {
  let cleanupRequestId:
    string | null = null;

  let candidateSnapshotPersisted =
    false;

  try {
    const body =
      await request
        .clone()
        .json();

    if (
      body?.confirmed !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            "La publication exige une confirmation explicite.",
        },
        {
          status: 400,
        }
      );
    }

    const proof =
      await requireBrainMultiSlotConfirmation({
        request,
        body,
      });

    const title =
      clean(
        body.title,
        120
      );

    const description =
      clean(
        body.description,
        2000
      );

    if (
      title.length < 3 ||
      description.length <
        10
    ) {
      return NextResponse.json(
        {
          error:
            "Titre et description requis.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: service,
      error: serviceError,
    } = await supabaseAdmin
      .from("services")
      .select(
        "id, name, slug"
      )
      .eq(
        "slug",
        proof.serviceSlug
      )
      .maybeSingle();

    if (serviceError) {
      throw new Error(
        serviceError.message
      );
    }

    if (!service) {
      return NextResponse.json(
        {
          error:
            "Service KLYX introuvable.",
        },
        {
          status: 404,
        }
      );
    }

    const serviceName =
      service.name
        ?.trim() ||
      service.slug;

    const prior =
      await existingPublishedRequest(
        proof.confirmationId,
        proof.profileId
      );

    let marketRequestId =
      prior?.id ?? null;

    let replayed =
      Boolean(prior);

    const durations =
      proof.slots.map(
        durationMinutes
      );

    if (
      durations.some(
        (value) =>
          value == null
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Un creneau contient une duree invalide.",
        },
        {
          status: 400,
        }
      );
    }

    const budgetTotal =
      totalBudget(
        proof.slots
      );

    const first =
      proof.slots[0];

    if (!marketRequestId) {
      const {
        data: created,
        error: createError,
      } = await supabaseAdmin
        .from(
          "market_service_requests"
        )
        .insert({
          client_profile_id:
            proof.profileId,
          service_id:
            service.id,
          title,
          description,
          city:
            proof.city,
          requested_date:
            first.date,
          requested_time:
            first.startTime +
            ":00",
          budget_max:
            budgetTotal,
          budget_total:
            budgetTotal,
          request_mode:
            "multi_slot",
          slot_count:
            proof.slots.length,
          prefer_single_provider:
            true,
          status:
            "open",
          brain_confirmation_message_id:
            proof.confirmationId,
        })
        .select("id")
        .single();

      if (createError) {
        if (
          createError.code !==
          "23505"
        ) {
          throw new Error(
            createError.message
          );
        }

        const raced =
          await existingPublishedRequest(
            proof.confirmationId,
            proof.profileId
          );

        if (!raced) {
          throw new Error(
            "Publication KLYX concurrente introuvable."
          );
        }

        marketRequestId =
          raced.id;
        replayed = true;
      } else {
        marketRequestId =
          created.id;
        cleanupRequestId =
          created.id;
      }
    }

    if (!marketRequestId) {
      throw new Error(
        "Demande KLYX introuvable apres publication."
      );
    }

    if (
      replayed &&
      await publicationWasCommitted({
        conversationId:
          proof.conversationId,
        confirmationId:
          proof.confirmationId,
        requestId:
          marketRequestId,
      })
    ) {
      return replayedResponse({
        requestId:
          marketRequestId,
        slotCount:
          proof.slots.length,
      });
    }

    const slotRows =
      proof.slots.map(
        (slot, index) => ({
          market_request_id:
            marketRequestId,
          position:
            index + 1,
          requested_date:
            slot.date,
          start_time:
            slot.startTime,
          end_time:
            slot.endTime,
          budget_max:
            slot.budget,
          duration_minutes:
            durations[index],
        })
      );

    let candidates:
      MultiSlotCandidate[];

    if (replayed) {
      const snapshotReady =
        await candidateSnapshotWasPersisted(
          marketRequestId,
          proof.slots.length
        );

      if (!snapshotReady) {
        return publicationInProgressResponse(
          marketRequestId
        );
      }

      candidates =
        await loadPersistedCandidates(
          marketRequestId
        );
    } else {
      candidates =
        await rankProvidersForMultiSlots({
          serviceId:
            service.id,
          slots:
            proof.slots,
        });

      // Only the creator writes the frozen ranking on its fresh parent.
      // Replays are read-only, so a second ranking can never be unioned in.
      if (
        candidates.length > 0
      ) {
        const {
          error:
            candidateError,
        } = await supabaseAdmin
          .from(
            "market_request_provider_candidates"
          )
          .insert(
            candidates.map(
              (candidate) => ({
                market_request_id:
                  marketRequestId,
                provider_profile_id:
                  candidate.providerProfileId,
                coverage_count:
                  candidate.coverageCount,
                slot_count:
                  candidate.slotCount,
                full_coverage:
                  candidate.fullCoverage,
              })
            )
          );

        if (candidateError) {
          throw new Error(
            candidateError
              .message
          );
        }
      }

      // Slots are the durable completion marker for the candidate snapshot.
      // This also covers the valid zero-candidate snapshot.
      const {
        error: slotsError,
      } = await supabaseAdmin
        .from(
          "market_service_request_slots"
        )
        .insert(slotRows);

      if (slotsError) {
        throw new Error(
          slotsError.message
        );
      }

      candidateSnapshotPersisted =
        true;
    }

    const fullCoverageCount =
      candidates.filter(
        (item) =>
          item.fullCoverage
      ).length;

    await notifyFullCoverageProviders({
      marketRequestId:
        marketRequestId,
      candidates,
      serviceName,
      city:
        proof.city,
      slotCount:
        proof.slots.length,
    });

    await ensurePublicationMarker({
      conversationId:
        proof.conversationId,
      confirmationId:
        proof.confirmationId,
      requestId:
        marketRequestId,
      slotCount:
        proof.slots.length,
      fullCoverageCount,
    });

    return NextResponse.json({
      requestId:
        marketRequestId,
      requestMode:
        "multi_slot",
      slotCount:
        proof.slots.length,
      candidateCount:
        candidates.length,
      fullCoverageCount,
      preferSingleProvider:
        true,
      href:
        "/assistant/market/" +
        marketRequestId,
      replayed,
      message:
        fullCoverageCount >
        0
          ? "Demande groupee publiee. KLYX privilegie les prestataires disponibles sur tous les creneaux."
          : "Demande groupee publiee. KLYX attend un prestataire capable de couvrir tous les creneaux.",
      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    if (
      cleanupRequestId &&
      !candidateSnapshotPersisted
    ) {
      await supabaseAdmin
        .from(
          "market_service_requests"
        )
        .delete()
        .eq(
          "id",
          cleanupRequestId
        );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Publication multi-creneaux impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}

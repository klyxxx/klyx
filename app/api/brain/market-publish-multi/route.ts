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

export async function POST(
  request: Request
) {
  let createdRequestId:
    string | null = null;

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
      })
      .select("id")
      .single();

    if (createError) {
      throw new Error(
        createError.message
      );
    }

    createdRequestId =
      created.id;

    const slotRows =
      proof.slots.map(
        (slot, index) => ({
          market_request_id:
            created.id,
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

    const candidates =
      await rankProvidersForMultiSlots({
        serviceId:
          service.id,
        slots:
          proof.slots,
      });

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
                created.id,
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

    await notifyFullCoverageProviders({
      marketRequestId:
        created.id,
      candidates,
      serviceName:
        service.name
          ?.trim() ||
        service.slug,
      city:
        proof.city,
      slotCount:
        proof.slots.length,
    });

    const fullCoverageCount =
      candidates.filter(
        (item) =>
          item.fullCoverage
      ).length;

    await supabaseAdmin
      .from(
        "brain_messages"
      )
      .insert({
        conversation_id:
          proof.conversationId,
        role:
          "assistant",
        content:
          fullCoverageCount >
          0
            ? "Demande multi-creneaux publiee. KLYX a trouve des prestataires couvrant tous les creneaux."
            : "Demande multi-creneaux publiee. Aucun prestataire ne couvre encore tous les creneaux.",
        payload: {
          action:
            "multi_slot_market_request_published",
          marketRequestId:
            created.id,
          slotCount:
            proof.slots.length,
          fullCoverageCount,
          automaticExecutionAllowed:
            false,
        },
      });

    return NextResponse.json({
      requestId:
        created.id,
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
        created.id,
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
      createdRequestId
    ) {
      await supabaseAdmin
        .from(
          "market_service_requests"
        )
        .delete()
        .eq(
          "id",
          createdRequestId
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
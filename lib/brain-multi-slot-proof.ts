import "server-only";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  brainConfirmationModeMatches,
} from "@/lib/brain-confirmation-mode";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_MULTI_SLOT_CONFIRMATION_PROOF_12_83

type UnknownRecord =
  Record<string, unknown>;

export type ConfirmedMultiSlot = {
  date: string;
  startTime: string;
  endTime: string;
  budget: number | null;
};

function record(
  value: unknown
): UnknownRecord | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function text(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function budget(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return (
    Math.round(
      parsed * 100
    ) / 100
  );
}

function validDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function validTime(
  value: string
) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value
  );
}

export function normalizeMultiSlotSchedule(
  value: unknown
): ConfirmedMultiSlot[] | null {
  let source: unknown = value;

  const root =
    record(value);

  if (root) {
    source =
      root.slots;
  }

  if (!Array.isArray(source)) {
    return null;
  }

  if (
    source.length < 2 ||
    source.length > 20
  ) {
    return null;
  }

  const slots:
    ConfirmedMultiSlot[] = [];

  for (
    const item
    of source
  ) {
    const row =
      record(item);

    if (!row) {
      return null;
    }

    const date =
      text(
        row.date ??
        row.requestedDate ??
        row.requested_date
      );

    const startTime =
      text(
        row.startTime ??
        row.start_time
      ).slice(0, 5);

    const endTime =
      text(
        row.endTime ??
        row.end_time
      ).slice(0, 5);

    if (
      !validDate(date) ||
      !validTime(startTime) ||
      !validTime(endTime) ||
      startTime === endTime
    ) {
      return null;
    }

    const rawBudget =
      row.budget ??
      row.budgetMax ??
      row.budget_max;

    const parsedBudget =
      rawBudget == null ||
      rawBudget === ""
        ? null
        : budget(rawBudget);

    if (
      rawBudget != null &&
      rawBudget !== "" &&
      parsedBudget == null
    ) {
      return null;
    }

    slots.push({
      date,
      startTime,
      endTime,
      budget:
        parsedBudget,
    });
  }

  return slots;
}

function extractRequest(
  payload: UnknownRecord
) {
  return (
    record(payload.request) ??
    payload
  );
}

function sameMoney(
  first: number | null,
  second: number | null
) {
  if (
    first == null &&
    second == null
  ) {
    return true;
  }

  if (
    first == null ||
    second == null
  ) {
    return false;
  }

  return (
    Math.abs(
      first - second
    ) < 0.01
  );
}

function sameSlots(
  first: ConfirmedMultiSlot[],
  second: ConfirmedMultiSlot[]
) {
  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  return first.every(
    (slot, index) => {
      const other =
        second[index];

      return (
        slot.date ===
          other.date &&
        slot.startTime ===
          other.startTime &&
        slot.endTime ===
          other.endTime &&
        sameMoney(
          slot.budget,
          other.budget
        )
      );
    }
  );
}

export async function requireBrainMultiSlotConfirmation(
  params: {
    request: Request;
    body: unknown;
  }
) {
  const { profile } =
    await getAuthenticatedProfile(
      params.request
    );

  requireAccountType(
    profile,
    "client"
  );

  const body =
    record(params.body);

  if (!body) {
    throw new Error(
      "Publication multi-creneaux invalide."
    );
  }

  const conversationId =
    text(
      body.conversationId ??
      body.conversation_id
    );

  const confirmationId =
    text(
      body.confirmationId ??
      body.confirmation_id
    );

  const requestedService =
    text(
      body.serviceSlug ??
      body.service_slug
    );

  const requestedCity =
    text(body.city);

  const requestedSlots =
    normalizeMultiSlotSchedule(
      body.schedule
    );

  if (
    !conversationId ||
    !confirmationId
  ) {
    throw new Error(
      "Confirmation explicite KLYX requise."
    );
  }

  if (
    !requestedService ||
    !requestedCity ||
    !requestedSlots
  ) {
    throw new Error(
      "La demande multi-creneaux doit etre complete."
    );
  }

  const {
    data: conversation,
    error: conversationError,
  } = await supabaseAdmin
    .from("brain_conversations")
    .select("id")
    .eq(
      "id",
      conversationId
    )
    .eq(
      "user_id",
      profile.id
    )
    .maybeSingle();

  if (conversationError) {
    throw new Error(
      conversationError.message
    );
  }

  if (!conversation) {
    throw new Error(
      "Conversation KLYX invalide."
    );
  }

  const {
    data: confirmation,
    error: confirmationError,
  } = await supabaseAdmin
    .from("brain_messages")
    .select(
      "id, payload"
    )
    .eq(
      "id",
      confirmationId
    )
    .eq(
      "conversation_id",
      conversationId
    )
    .eq(
      "role",
      "user"
    )
    .maybeSingle();

  if (confirmationError) {
    throw new Error(
      confirmationError.message
    );
  }

  if (!confirmation) {
    throw new Error(
      "Preuve de confirmation KLYX invalide."
    );
  }

  const payload =
    record(
      confirmation.payload
    );

  if (
    !payload ||
    payload.action !==
      "confirm_request" ||
    payload.confirmed !== true ||
    payload.automaticExecutionAllowed !==
      false
  ) {
    throw new Error(
      "Cette preuve ne correspond pas a une confirmation explicite."
    );
  }

  if (
    !brainConfirmationModeMatches(
      payload,
      "multi_slot"
    )
  ) {
    throw new Error(
      "Type de confirmation KLYX invalide pour cette publication."
    );
  }

  const confirmedRequest =
    extractRequest(
      payload
    );

  const confirmedService =
    text(
      confirmedRequest.serviceSlug
    );

  const confirmedCity =
    text(
      confirmedRequest.city
    );

  const confirmedSlots =
    normalizeMultiSlotSchedule(
      confirmedRequest.schedule
    );

  if (
    !confirmedSlots
  ) {
    throw new Error(
      "La confirmation ne contient pas les creneaux."
    );
  }

  if (
    confirmedService
      .toLowerCase() !==
      requestedService
        .toLowerCase() ||
    confirmedCity
      .toLowerCase() !==
      requestedCity
        .toLowerCase() ||
    !sameSlots(
      confirmedSlots,
      requestedSlots
    )
  ) {
    throw new Error(
      "La demande a change depuis sa confirmation. Confirme-la de nouveau."
    );
  }

  return {
    profileId:
      profile.id,
    conversationId,
    confirmationId,
    serviceSlug:
      requestedService,
    city:
      requestedCity,
    slots:
      requestedSlots,
  };
}
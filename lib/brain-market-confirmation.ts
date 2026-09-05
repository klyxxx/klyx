import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  brainConfirmationModeMatches,
} from "@/lib/brain-confirmation-mode";
import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

// KLYX_MARKET_CONFIRMATION_HELPER_12_65

type UnknownRecord = Record<string, unknown>;

type RequestSnapshot = {
  serviceSlug: string;
  city: string;
  date: string;
  time: string;
  budget: number | null;
};

type ConfirmationRow = {
  id: string;
  payload: unknown;
};

function asRecord(
  value: unknown
): UnknownRecord | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function readString(
  record: UnknownRecord | null,
  keys: string[]
): string | null {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];

    if (typeof value !== "string") {
      continue;
    }

    const cleaned = value.trim();

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function readBudget(
  record: UnknownRecord | null
): number | null {
  if (!record) return null;

  const value =
    record.budget ??
    record.maxBudget ??
    record.max_budget;

  if (value == null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function extractSnapshot(
  value: unknown
): RequestSnapshot | null {
  const root = asRecord(value);

  if (!root) return null;

  const nested =
    asRecord(root.request) ??
    asRecord(root.requestSnapshot) ??
    asRecord(root.snapshot) ??
    root;

  const serviceSlug = readString(
    nested,
    [
      "serviceSlug",
      "service_slug",
      "service",
    ]
  );

  const city = readString(
    nested,
    ["city", "ville"]
  );

  const date = readString(
    nested,
    ["date"]
  );

  const time = readString(
    nested,
    ["time", "heure"]
  );

  if (
    !serviceSlug ||
    !city ||
    !date ||
    !time
  ) {
    return null;
  }

  return {
    serviceSlug,
    city,
    date,
    time,
    budget: readBudget(nested),
  };
}

function readProofValue(
  root: UnknownRecord,
  keys: string[]
): string | null {
  const direct = readString(root, keys);

  if (direct) return direct;

  const proof =
    asRecord(root.proof) ??
    asRecord(root.confirmation);

  return readString(proof, keys);
}

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase("fr-BE");
}

function budgetsMatch(
  left: number | null,
  right: number | null
) {
  if (left == null && right == null) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return Math.abs(left - right) < 0.01;
}

function snapshotsMatch(
  confirmed: RequestSnapshot,
  requested: RequestSnapshot
) {
  return (
    normalizedText(confirmed.serviceSlug) ===
      normalizedText(requested.serviceSlug) &&
    normalizedText(confirmed.city) ===
      normalizedText(requested.city) &&
    confirmed.date === requested.date &&
    confirmed.time === requested.time &&
    budgetsMatch(
      confirmed.budget,
      requested.budget
    )
  );
}

export async function requireBrainMarketConfirmation(
  params: {
    request: Request;
    body: unknown;
  }
) {
  const { profile } =
    await getAuthenticatedProfile(params.request);

  requireAccountType(profile, "client");

  const root = asRecord(params.body);

  if (!root) {
    throw new Error(
      "Corps de publication KLYX invalide."
    );
  }

  const conversationId = readProofValue(
    root,
    [
      "conversationId",
      "conversation_id",
    ]
  );

  const confirmationId = readProofValue(
    root,
    [
      "confirmationId",
      "confirmation_id",
    ]
  );

  if (!conversationId || !confirmationId) {
    throw new Error(
      "Confirmation explicite KLYX requise avant publication."
    );
  }

  const requestedSnapshot =
    extractSnapshot(root);

  if (!requestedSnapshot) {
    throw new Error(
      "La demande a publier doit etre complete."
    );
  }

  const {
    data: conversation,
    error: conversationError,
  } = await supabaseAdmin
    .from("brain_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (conversationError) {
    throw new Error(
      conversationError.message
    );
  }

  if (!conversation) {
    throw new Error(
      "Conversation KLYX invalide pour cette publication."
    );
  }

  const {
    data: confirmationData,
    error: confirmationError,
  } = await supabaseAdmin
    .from("brain_messages")
    .select("id, payload")
    .eq("id", confirmationId)
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .maybeSingle();

  if (confirmationError) {
    throw new Error(
      confirmationError.message
    );
  }

  if (!confirmationData) {
    throw new Error(
      "Preuve de confirmation KLYX invalide."
    );
  }

  const confirmation =
    confirmationData as ConfirmationRow;

  const payload =
    asRecord(confirmation.payload);

  if (
    !payload ||
    payload.action !== "confirm_request" ||
    payload.confirmed !== true
  ) {
    throw new Error(
      "Cette preuve ne correspond pas a une confirmation explicite."
    );
  }

  if (payload.automaticExecutionAllowed !== false) {
    throw new Error(
      "Politique de confirmation KLYX invalide."
    );
  }

  if (
    !brainConfirmationModeMatches(
      payload,
      "single"
    )
  ) {
    throw new Error(
      "Type de confirmation KLYX invalide pour cette publication."
    );
  }

  const confirmedSnapshot =
    extractSnapshot(payload);

  if (!confirmedSnapshot) {
    throw new Error(
      "La confirmation KLYX ne contient pas de demande complete."
    );
  }

  if (
    !snapshotsMatch(
      confirmedSnapshot,
      requestedSnapshot
    )
  ) {
    throw new Error(
      "La demande a change depuis sa confirmation. Confirme-la de nouveau."
    );
  }

  return {
    profileId: profile.id,
    conversationId,
    confirmationId,
    request: requestedSnapshot,
  };
}
import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  isValidKlyxProviderCapabilityLabel,
  normalizeKlyxProviderCapabilityLabel,
} from "@/lib/provider-capabilities";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CAPABILITY_SELECT =
  "id, profile_id, label, normalized_label, description, source, status, canonical_service_id, created_at, updated_at";
const DESCRIPTION_MAX_LENGTH = 1200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SERVER_MANAGED_FIELDS = [
  "profileId",
  "profile_id",
  "source",
  "canonicalServiceId",
  "canonical_service_id",
  "normalizedLabel",
  "normalized_label",
  "originText",
  "origin_text",
] as const;

type JsonObject = Record<string, unknown>;

type DescriptionResult =
  | { ok: true; value: string | null }
  | { ok: false };

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDescription(value: unknown): DescriptionResult {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const description = value.trim();

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return { ok: false };
  }

  return { ok: true, value: description || null };
}

function hasServerManagedField(body: JsonObject): boolean {
  return SERVER_MANAGED_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
}

function isUniqueViolation(error: { code?: string | null } | null): boolean {
  return error?.code === "23505";
}

async function activeDuplicate(
  profileId: string,
  normalizedLabel: string,
  excludedId?: string
): Promise<boolean> {
  let query = supabaseAdmin
    .from("provider_capabilities")
    .select("id")
    .eq("profile_id", profileId)
    .eq("normalized_label", normalizedLabel)
    .neq("status", "archived");

  if (excludedId) {
    query = query.neq("id", excludedId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.length ?? 0) > 0;
}

function invalidPayload(code: string, error: string, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { data, error } = await supabaseAdmin
      .from("provider_capabilities")
      .select(CAPABILITY_SELECT)
      .eq("profile_id", profile.id)
      .order("status", { ascending: true })
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ capabilities: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les compétences.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const rawBody: unknown = await request.json().catch(() => null);

    if (!isJsonObject(rawBody)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_INVALID_PAYLOAD",
        "Données de compétence invalides."
      );
    }

    if (hasServerManagedField(rawBody)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_MANAGED_FIELD",
        "Un champ de compétence est géré uniquement par KLYX."
      );
    }

    if (
      typeof rawBody.label !== "string" ||
      !isValidKlyxProviderCapabilityLabel(rawBody.label)
    ) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_INVALID_LABEL",
        "Indique une compétence valide."
      );
    }

    const label = rawBody.label.trim();
    const normalizedLabel = normalizeKlyxProviderCapabilityLabel(label);
    const description = parseDescription(rawBody.description);

    if (!description.ok) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_INVALID_DESCRIPTION",
        "La description de la compétence est invalide."
      );
    }

    if (await activeDuplicate(profile.id, normalizedLabel)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_DUPLICATE",
        "Cette compétence est déjà déclarée.",
        409
      );
    }

    const { data, error } = await supabaseAdmin
      .from("provider_capabilities")
      .insert({
        profile_id: profile.id,
        label,
        normalized_label: normalizedLabel,
        description: description.value,
        source: "provider",
        status: "confirmed",
        canonical_service_id: null,
        origin_text: null,
      })
      .select(CAPABILITY_SELECT)
      .single();

    if (isUniqueViolation(error)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_DUPLICATE",
        "Cette compétence est déjà déclarée.",
        409
      );
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ capability: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'ajouter la compétence.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const rawBody: unknown = await request.json().catch(() => null);

    if (!isJsonObject(rawBody)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_INVALID_PAYLOAD",
        "Données de compétence invalides."
      );
    }

    if (hasServerManagedField(rawBody)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_MANAGED_FIELD",
        "Un champ de compétence est géré uniquement par KLYX."
      );
    }

    const id = typeof rawBody.id === "string" ? rawBody.id.trim() : "";

    if (!UUID_PATTERN.test(id)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_INVALID_ID",
        "Identifiant de compétence invalide."
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("provider_capabilities")
      .select("id, label, normalized_label, description, status")
      .eq("id", id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existing) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_NOT_FOUND",
        "Compétence introuvable.",
        404
      );
    }

    const updates: Record<string, string | null> = {};

    if (Object.prototype.hasOwnProperty.call(rawBody, "label")) {
      if (
        typeof rawBody.label !== "string" ||
        !isValidKlyxProviderCapabilityLabel(rawBody.label)
      ) {
        return invalidPayload(
          "KLYX_PROVIDER_CAPABILITY_INVALID_LABEL",
          "Indique une compétence valide."
        );
      }

      const label = rawBody.label.trim();
      const normalizedLabel = normalizeKlyxProviderCapabilityLabel(label);

      if (await activeDuplicate(profile.id, normalizedLabel, id)) {
        return invalidPayload(
          "KLYX_PROVIDER_CAPABILITY_DUPLICATE",
          "Cette compétence est déjà déclarée.",
          409
        );
      }

      updates.label = label;
      updates.normalized_label = normalizedLabel;
    }

    if (Object.prototype.hasOwnProperty.call(rawBody, "description")) {
      const description = parseDescription(rawBody.description);

      if (!description.ok) {
        return invalidPayload(
          "KLYX_PROVIDER_CAPABILITY_INVALID_DESCRIPTION",
          "La description de la compétence est invalide."
        );
      }

      updates.description = description.value;
    }

    if (Object.prototype.hasOwnProperty.call(rawBody, "status")) {
      if (
        rawBody.status !== "confirmed" &&
        rawBody.status !== "archived"
      ) {
        return invalidPayload(
          "KLYX_PROVIDER_CAPABILITY_INVALID_STATUS",
          "Statut de compétence invalide."
        );
      }

      updates.status = rawBody.status;
    }

    if (Object.keys(updates).length === 0) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_NO_CHANGES",
        "Aucune modification de compétence à enregistrer."
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("provider_capabilities")
      .update(updates)
      .eq("id", id)
      .eq("profile_id", profile.id)
      .select(CAPABILITY_SELECT)
      .single();

    if (isUniqueViolation(error)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_DUPLICATE",
        "Cette compétence est déjà déclarée.",
        409
      );
    }

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ capability: data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de modifier la compétence.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

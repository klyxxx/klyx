import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LINK_SELECT =
  "id, profile_id, capability_id, user_service_id, created_at";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidPayload(code: string, error: string, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

function parseLinkIds(body: JsonObject):
  | { ok: true; capabilityId: string; userServiceId: string }
  | { ok: false; response: Response } {
  if (
    Object.prototype.hasOwnProperty.call(body, "profileId") ||
    Object.prototype.hasOwnProperty.call(body, "profile_id")
  ) {
    return {
      ok: false,
      response: invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_MANAGED_FIELD",
        "Le profil du lien est géré uniquement par KLYX."
      ),
    };
  }

  const capabilityId =
    typeof body.capabilityId === "string" ? body.capabilityId.trim() : "";
  const userServiceId =
    typeof body.userServiceId === "string" ? body.userServiceId.trim() : "";

  if (!UUID_PATTERN.test(capabilityId) || !UUID_PATTERN.test(userServiceId)) {
    return {
      ok: false,
      response: invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_INVALID_ID",
        "Identifiant de compétence ou de service invalide."
      ),
    };
  }

  return { ok: true, capabilityId, userServiceId };
}

async function ownsConfirmedCapability(
  profileId: string,
  capabilityId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("provider_capabilities")
    .select("id")
    .eq("id", capabilityId)
    .eq("profile_id", profileId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function ownsProviderService(
  profileId: string,
  userServiceId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_services")
    .select("id")
    .eq("id", userServiceId)
    .eq("user_id", profileId)
    .eq("provider_enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function requireOwnedParents(
  profileId: string,
  capabilityId: string,
  userServiceId: string
): Promise<Response | null> {
  const [capabilityOwned, serviceOwned] = await Promise.all([
    ownsConfirmedCapability(profileId, capabilityId),
    ownsProviderService(profileId, userServiceId),
  ]);

  if (!capabilityOwned) {
    return invalidPayload(
      "KLYX_PROVIDER_CAPABILITY_LINK_CAPABILITY_NOT_FOUND",
      "Compétence confirmée introuvable.",
      404
    );
  }

  if (!serviceOwned) {
    return invalidPayload(
      "KLYX_PROVIDER_CAPABILITY_LINK_SERVICE_NOT_FOUND",
      "Service prestataire introuvable.",
      404
    );
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const { data, error } = await supabaseAdmin
      .from("provider_service_capabilities")
      .select(LINK_SELECT)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ links: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les liens de compétences.";

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
        "KLYX_PROVIDER_CAPABILITY_LINK_INVALID_PAYLOAD",
        "Données de lien invalides."
      );
    }

    const parsed = parseLinkIds(rawBody);
    if (!parsed.ok) return parsed.response;

    const { capabilityId, userServiceId } = parsed;
    const parentError = await requireOwnedParents(
      profile.id,
      capabilityId,
      userServiceId
    );
    if (parentError) return parentError;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("provider_service_capabilities")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("capability_id", capabilityId)
      .eq("user_service_id", userServiceId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_DUPLICATE",
        "Cette compétence est déjà liée à ce service.",
        409
      );
    }

    const { data, error } = await supabaseAdmin
      .from("provider_service_capabilities")
      .insert({
        profile_id: profile.id,
        capability_id: capabilityId,
        user_service_id: userServiceId,
      })
      .select(LINK_SELECT)
      .single();

    if (error?.code === "23505") {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_DUPLICATE",
        "Cette compétence est déjà liée à ce service.",
        409
      );
    }

    if (error) throw new Error(error.message);

    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de lier la compétence au service.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "provider");

    const rawBody: unknown = await request.json().catch(() => null);
    if (!isJsonObject(rawBody)) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_INVALID_PAYLOAD",
        "Données de lien invalides."
      );
    }

    const parsed = parseLinkIds(rawBody);
    if (!parsed.ok) return parsed.response;

    const { capabilityId, userServiceId } = parsed;

    const { data, error } = await supabaseAdmin
      .from("provider_service_capabilities")
      .delete()
      .eq("profile_id", profile.id)
      .eq("capability_id", capabilityId)
      .eq("user_service_id", userServiceId)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return invalidPayload(
        "KLYX_PROVIDER_CAPABILITY_LINK_NOT_FOUND",
        "Lien de compétence introuvable.",
        404
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de supprimer le lien de compétence.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

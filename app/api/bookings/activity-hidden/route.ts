import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { secureApiErrorResponse } from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_ACTIVITY_HIDDEN_MISSIONS_API_2026_09_05

type HiddenEntityType = "booking" | "group" | "split";

type HiddenMissionRow = {
  entity_type: HiddenEntityType;
  entity_id: string;
  created_at: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isHiddenEntityType(value: unknown): value is HiddenEntityType {
  return value === "booking" || value === "group" || value === "split";
}

async function clientOwnsMission(
  clientProfileId: string,
  entityType: HiddenEntityType,
  entityId: string
): Promise<boolean> {
  if (entityType === "booking") {
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("id", entityId)
      .eq("parent_id", clientProfileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return Boolean(data?.id);
  }

  if (entityType === "group") {
    const { data, error } = await supabaseAdmin
      .from("booking_groups")
      .select("id")
      .eq("id", entityId)
      .eq("client_profile_id", clientProfileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return Boolean(data?.id);
  }

  const { data, error } = await supabaseAdmin
    .from("split_booking_batches")
    .select("id")
    .eq("id", entityId)
    .eq("client_profile_id", clientProfileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const { data, error } = await supabaseAdmin
      .from("activity_hidden_missions")
      .select("entity_type, entity_id, created_at")
      .eq("client_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const hidden = ((data ?? []) as HiddenMissionRow[]).map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      hiddenAt: row.created_at,
    }));

    return NextResponse.json({ ok: true, hidden });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de charger les missions masquées.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "activity_hidden_missions_load_failed",
      route: "/api/bookings/activity-hidden",
      method: "GET",
      status,
      code: "activity_hidden_missions_load_failed",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json().catch(() => null)) as
      | { entityType?: unknown; entityId?: unknown }
      | null;
    const entityType = body?.entityType;
    const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";

    if (!isHiddenEntityType(entityType) || !UUID_PATTERN.test(entityId)) {
      return NextResponse.json(
        { ok: false, error: "Mission invalide." },
        { status: 400 }
      );
    }

    const owned = await clientOwnsMission(profile.id, entityType, entityId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Mission introuvable." },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from("activity_hidden_missions")
      .upsert(
        {
          client_profile_id: profile.id,
          entity_type: entityType,
          entity_id: entityId,
        },
        { onConflict: "client_profile_id,entity_type,entity_id", ignoreDuplicates: true }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      entityType,
      entityId,
      sourceRecordsDeleted: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de supprimer cette mission de l’activité.";
    const status = apiErrorStatus(message);

    return secureApiErrorResponse({
      error,
      event: "activity_hidden_mission_write_failed",
      route: "/api/bookings/activity-hidden",
      method: "POST",
      status,
      code: "activity_hidden_mission_write_failed",
      publicMessage: status < 500 ? message : undefined,
      startedAt,
      details: { sourceRecordsDeleted: false },
    });
  }
}

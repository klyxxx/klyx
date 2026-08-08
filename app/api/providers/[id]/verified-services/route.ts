import { NextResponse } from "next/server";

import { getApprovedUserServiceIds } from "@/lib/provider-skill-publication";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("user_services")
      .select("id")
      .eq("user_id", providerId)
      .eq("active", true)
      .eq("provider_enabled", true);

    if (error) throw new Error(error.message);

    const approved = await getApprovedUserServiceIds(
      (data ?? []).map((row) => row.id as string)
    );

    return NextResponse.json({
      userServiceIds: Array.from(approved),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chargement impossible.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_PHONE_PRIVACY_API_12_75

type Visibility =
  | "private"
  | "transaction_participants";

type PrivacyBody = {
  visibility?: Visibility;
};

type PhonePrivacyRow = {
  phone_number: string | null;
  phone_verified_at: string | null;
  phone_visibility: string | null;
};

function normalizeVisibility(
  value: string | null
): Visibility {
  return value === "private"
    ? "private"
    : "transaction_participants";
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const { data, error } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "phone_number, phone_verified_at, phone_visibility"
        )
        .eq("id", profile.id)
        .single();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as PhonePrivacyRow;

    return NextResponse.json({
      visibility:
        normalizeVisibility(
          row.phone_visibility
        ),
      hasPhone: Boolean(
        row.phone_number?.trim()
      ),
      verified: Boolean(
        row.phone_verified_at
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Confidentialite telephone indisponible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const body =
      (await request.json()) as PrivacyBody;

    if (
      body.visibility !== "private" &&
      body.visibility !==
        "transaction_participants"
    ) {
      return NextResponse.json(
        {
          error:
            "Option de confidentialite invalide.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("profiles")
        .update({
          phone_visibility:
            body.visibility,
        })
        .eq("id", profile.id)
        .select(
          "phone_number, phone_verified_at, phone_visibility"
        )
        .single();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as PhonePrivacyRow;

    return NextResponse.json({
      saved: true,
      visibility:
        normalizeVisibility(
          row.phone_visibility
        ),
      hasPhone: Boolean(
        row.phone_number?.trim()
      ),
      verified: Boolean(
        row.phone_verified_at
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Modification impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

// KLYX_PHONE_API_12_67

type PhoneBody = {
  phoneNumber?: string | null;
};

type PhoneRow = {
  phone_number: string | null;
  phone_verified_at: string | null;
  phone_visibility: string | null;
};

function normalizePhone(
  value: string | null | undefined
): string | null {
  if (value == null) return null;

  let cleaned = value
    .trim()
    .replace(/[()\s.\-]/g, "");

  if (!cleaned) return null;

  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  return cleaned;
}

function isValidInternationalPhone(
  value: string
) {
  return /^\+[1-9]\d{7,14}$/.test(value);
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

    const row = data as PhoneRow;

    return NextResponse.json({
      phoneNumber: row.phone_number,
      verified: Boolean(
        row.phone_verified_at
      ),
      verifiedAt:
        row.phone_verified_at,
      visibility:
        row.phone_visibility ??
        "transaction_participants",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Telephone KLYX indisponible.";

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
      (await request.json()) as PhoneBody;

    const phoneNumber =
      normalizePhone(body.phoneNumber);

    if (
      phoneNumber &&
      !isValidInternationalPhone(phoneNumber)
    ) {
      return NextResponse.json(
        {
          error:
            "Utilise un numero international, par exemple +32471503513.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("profiles")
        .update({
          phone_number: phoneNumber,
          phone_verified_at: null,
          phone_visibility:
            "transaction_participants",
        })
        .eq("id", profile.id)
        .select(
          "phone_number, phone_verified_at, phone_visibility"
        )
        .single();

    if (error) {
      throw new Error(error.message);
    }

    const row = data as PhoneRow;

    return NextResponse.json({
      saved: true,
      phoneNumber: row.phone_number,
      verified: false,
      verifiedAt: null,
      visibility:
        row.phone_visibility ??
        "transaction_participants",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Enregistrement du telephone impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
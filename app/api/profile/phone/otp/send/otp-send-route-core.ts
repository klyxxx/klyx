import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPhoneOtp } from "@/lib/twilio-verify";

// KLYX_PHONE_OTP_SEND_SECURITY_12_71

type PhoneRow = {
  phone_number: string | null;
  phone_verified_at: string | null;
};

type LimitRow = {
  profile_id: string;
  last_sent_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
};

const SEND_COOLDOWN_SECONDS = 60;

function secondsUntil(value: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(value).getTime() - Date.now()) /
        1000
    )
  );
}

function maskPhone(value: string) {
  if (value.length <= 6) return value;

  return (
    value.slice(0, 4) +
    "****" +
    value.slice(-3)
  );
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const { data: phoneData, error: phoneError } =
      await supabaseAdmin
        .from("profiles")
        .select("phone_number, phone_verified_at")
        .eq("id", profile.id)
        .single();

    if (phoneError) {
      throw new Error(phoneError.message);
    }

    const phone = phoneData as PhoneRow;

    const phoneNumber =
      phone.phone_number?.trim() ?? "";

    if (!phoneNumber) {
      return NextResponse.json(
        {
          error:
            "Enregistre ton numero avant de demander un code.",
        },
        { status: 400 }
      );
    }

    if (phone.phone_verified_at) {
      return NextResponse.json({
        sent: false,
        alreadyVerified: true,
        verified: true,
      });
    }

    const { data: limitData, error: limitError } =
      await supabaseAdmin
        .from("phone_verification_limits")
        .select(
          "profile_id, last_sent_at, failed_attempts, locked_until"
        )
        .eq("profile_id", profile.id)
        .maybeSingle();

    if (limitError) {
      throw new Error(limitError.message);
    }

    const limits =
      limitData as LimitRow | null;

    if (
      limits?.locked_until &&
      new Date(limits.locked_until).getTime() >
        Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Verification temporairement bloquee apres plusieurs codes incorrects.",
          retryAfter: secondsUntil(
            limits.locked_until
          ),
        },
        { status: 429 }
      );
    }

    if (limits?.last_sent_at) {
      const elapsedSeconds =
        (Date.now() -
          new Date(
            limits.last_sent_at
          ).getTime()) /
        1000;

      if (
        elapsedSeconds <
        SEND_COOLDOWN_SECONDS
      ) {
        return NextResponse.json(
          {
            error:
              "Attends avant de demander un nouveau code.",
            retryAfter: Math.ceil(
              SEND_COOLDOWN_SECONDS -
                elapsedSeconds
            ),
          },
          { status: 429 }
        );
      }
    }

    const sentAt =
      new Date().toISOString();

    const { error: claimError } =
      await supabaseAdmin
        .from("phone_verification_limits")
        .upsert(
          {
            profile_id: profile.id,
            last_sent_at: sentAt,
            updated_at: sentAt,
          },
          {
            onConflict: "profile_id",
          }
        );

    if (claimError) {
      throw new Error(claimError.message);
    }

    await sendPhoneOtp(phoneNumber);

    return NextResponse.json({
      sent: true,
      verified: false,
      maskedPhone: maskPhone(phoneNumber),
      retryAfter: SEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Envoi du code impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
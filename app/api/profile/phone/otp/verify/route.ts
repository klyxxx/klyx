import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPhoneOtp } from "@/lib/twilio-verify";

// KLYX_PHONE_OTP_VERIFY_SECURITY_12_71

type VerifyBody = {
  code?: string;
};

type PhoneRow = {
  phone_number: string | null;
  phone_verified_at: string | null;
};

type LimitRow = {
  failed_attempts: number;
  locked_until: string | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function secondsUntil(value: string) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(value).getTime() - Date.now()) /
        1000
    )
  );
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const body =
      (await request.json()) as VerifyBody;

    const code =
      body.code?.trim() ?? "";

    if (!/^\d{4,10}$/.test(code)) {
      return NextResponse.json(
        { error: "Code OTP invalide." },
        { status: 400 }
      );
    }

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
        { error: "Numero KLYX introuvable." },
        { status: 400 }
      );
    }

    if (phone.phone_verified_at) {
      return NextResponse.json({
        verified: true,
        alreadyVerified: true,
        verifiedAt:
          phone.phone_verified_at,
      });
    }

    const { data: limitData, error: limitError } =
      await supabaseAdmin
        .from("phone_verification_limits")
        .select("failed_attempts, locked_until")
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
            "Trop de codes incorrects. Reessaie plus tard.",
          retryAfter: secondsUntil(
            limits.locked_until
          ),
        },
        { status: 429 }
      );
    }

    const result =
      await verifyPhoneOtp(
        phoneNumber,
        code
      );

    if (!result.approved) {
      const failedAttempts =
        (limits?.failed_attempts ?? 0) + 1;

      const shouldLock =
        failedAttempts >=
        MAX_FAILED_ATTEMPTS;

      const lockedUntil = shouldLock
        ? new Date(
            Date.now() +
              LOCK_MINUTES * 60 * 1000
          ).toISOString()
        : null;

      const now = new Date().toISOString();

      const { error: failureError } =
        await supabaseAdmin
          .from("phone_verification_limits")
          .upsert(
            {
              profile_id: profile.id,
              failed_attempts:
                failedAttempts,
              locked_until:
                lockedUntil,
              updated_at: now,
            },
            {
              onConflict: "profile_id",
            }
          );

      if (failureError) {
        throw new Error(
          failureError.message
        );
      }

      if (shouldLock && lockedUntil) {
        return NextResponse.json(
          {
            error:
              "Trop de codes incorrects. Verification bloquee pendant 15 minutes.",
            retryAfter: secondsUntil(
              lockedUntil
            ),
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Code incorrect ou expire.",
          attemptsRemaining: Math.max(
            0,
            MAX_FAILED_ATTEMPTS -
              failedAttempts
          ),
        },
        { status: 400 }
      );
    }

    const verifiedAt =
      new Date().toISOString();

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          phone_verified_at:
            verifiedAt,
        })
        .eq("id", profile.id)
        .eq("phone_number", phoneNumber)
        .select(
          "phone_number, phone_verified_at"
        )
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Le numero a change pendant la verification.",
        },
        { status: 409 }
      );
    }

    const { error: resetError } =
      await supabaseAdmin
        .from("phone_verification_limits")
        .upsert(
          {
            profile_id: profile.id,
            failed_attempts: 0,
            locked_until: null,
            updated_at: verifiedAt,
          },
          {
            onConflict: "profile_id",
          }
        );

    if (resetError) {
      throw new Error(resetError.message);
    }

    return NextResponse.json({
      verified: true,
      verifiedAt,
      phoneNumber,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Verification impossible.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
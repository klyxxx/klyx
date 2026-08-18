import { NextResponse } from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";
import {
  secureApiErrorResponse,
} from "@/lib/api-error";
import { supabaseAdmin } from "@/lib/supabase-admin";

// KLYX_REVALIDATED_PHONE_CALL_API_12_74

type BookingRow = {
  id: string;
  parent_id: string;
  provider_id: string | null;
  babysitter_id: string | null;
  status: string;
  completed_at: string | null;
};

type ContactProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  phone_verified_at: string | null;
  phone_visibility: string | null;
};

type ReadyContact = {
  booking: BookingRow;
  viewerProfileId: string;
  otherProfile: ContactProfileRow;
  otherName: string;
  phoneNumber: string;
  accessExpiresAt: string | null;
};

type DeniedContact = {
  response: NextResponse;
};

const COMPLETED_CONTACT_HOURS = 24;
const DISPLAY_MINUTES = 5;

function formatName(
  profile: ContactProfileRow
) {
  return (
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Utilisateur KLYX"
  );
}

function isTransactionVisible(
  profile: ContactProfileRow
) {
  return (
    profile.phone_visibility == null ||
    profile.phone_visibility ===
      "transaction_participants"
  );
}

function completedAccessExpiresAt(
  completedAt: string
) {
  return new Date(
    new Date(completedAt).getTime() +
      COMPLETED_CONTACT_HOURS * 60 * 60 * 1000
  );
}

function displayExpiresAt() {
  return new Date(
    Date.now() +
      DISPLAY_MINUTES * 60 * 1000
  ).toISOString();
}

async function resolveContact(
  request: Request,
  bookingId: string
): Promise<ReadyContact | DeniedContact> {
  const { profile } =
    await getAuthenticatedProfile(request);

  const { data, error } =
    await supabaseAdmin
      .from("bookings")
      .select(
        "id, parent_id, provider_id, babysitter_id, status, completed_at"
      )
      .eq("id", bookingId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      response: NextResponse.json(
        { error: "Reservation introuvable." },
        { status: 404 }
      ),
    };
  }

  const booking = data as BookingRow;

  const providerId =
    booking.provider_id ??
    booking.babysitter_id;

  if (!providerId) {
    return {
      response: NextResponse.json(
        { error: "Prestataire introuvable." },
        { status: 409 }
      ),
    };
  }

  const isClient =
    booking.parent_id === profile.id;

  const isProvider =
    providerId === profile.id;

  if (!isClient && !isProvider) {
    return {
      response: NextResponse.json(
        { error: "Acces refuse." },
        { status: 403 }
      ),
    };
  }

  if (
    booking.status !== "accepted" &&
    booking.status !== "completed"
  ) {
    return {
      response: NextResponse.json({
        contactAllowed: false,
        canReveal: false,
        reason: "status_not_allowed",
        message:
          "Le contact est disponible uniquement pour une mission acceptee.",
      }),
    };
  }

  let accessExpiresAt: string | null = null;

  if (booking.status === "completed") {
    if (!booking.completed_at) {
      return {
        response: NextResponse.json({
          contactAllowed: false,
          canReveal: false,
          reason: "missing_completion_time",
          message:
            "La periode de contact ne peut pas etre determinee.",
        }),
      };
    }

    const expiresAt =
      completedAccessExpiresAt(
        booking.completed_at
      );

    accessExpiresAt =
      expiresAt.toISOString();

    if (expiresAt.getTime() <= Date.now()) {
      return {
        response: NextResponse.json({
          contactAllowed: false,
          canReveal: false,
          reason: "contact_expired",
          accessExpiresAt,
          message:
            "La periode de contact telephonique est terminee.",
        }),
      };
    }
  }

  const otherProfileId =
    isClient
      ? providerId
      : booking.parent_id;

  const {
    data: profilesData,
    error: profilesError,
  } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, first_name, last_name, phone_number, phone_verified_at, phone_visibility"
    )
    .in("id", [
      profile.id,
      otherProfileId,
    ]);

  if (profilesError) {
    throw new Error(
      profilesError.message
    );
  }

  const profiles =
    (profilesData ?? []) as ContactProfileRow[];

  const ownProfile =
    profiles.find(
      (item) => item.id === profile.id
    );

  const otherProfile =
    profiles.find(
      (item) => item.id === otherProfileId
    );

  if (!ownProfile || !otherProfile) {
    return {
      response: NextResponse.json(
        { error: "Profil de contact introuvable." },
        { status: 404 }
      ),
    };
  }

  const otherName =
    formatName(otherProfile);

  const ownPhone =
    ownProfile.phone_number?.trim() ?? "";

  if (!ownPhone) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        actionRequired: "verify_own_phone",
        reason: "own_missing_phone",
        message:
          "Ajoute ton numero avant d acceder au contact.",
      }),
    };
  }

  if (!ownProfile.phone_verified_at) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        actionRequired: "verify_own_phone",
        reason: "own_unverified_phone",
        message:
          "Verifie ton numero par SMS avant d acceder au contact.",
      }),
    };
  }

  if (!isTransactionVisible(ownProfile)) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        actionRequired: "verify_own_phone",
        reason: "own_private_phone",
        message:
          "Ton numero est actuellement prive.",
      }),
    };
  }

  const otherPhone =
    otherProfile.phone_number?.trim() ?? "";

  if (!otherPhone) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        reason: "other_missing_phone",
        message:
          otherName +
          " n a pas encore ajoute de numero.",
      }),
    };
  }

  if (!otherProfile.phone_verified_at) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        reason: "other_unverified_phone",
        message:
          "Le numero de " +
          otherName +
          " doit encore etre verifie.",
      }),
    };
  }

  if (!isTransactionVisible(otherProfile)) {
    return {
      response: NextResponse.json({
        contactAllowed: true,
        canReveal: false,
        otherName,
        accessExpiresAt,
        reason: "other_private_phone",
        message:
          otherName +
          " ne partage pas son numero.",
      }),
    };
  }

  return {
    booking,
    viewerProfileId: profile.id,
    otherProfile,
    otherName,
    phoneNumber: otherPhone,
    accessExpiresAt,
  };
}

function isDenied(
  value: ReadyContact | DeniedContact
): value is DeniedContact {
  return "response" in value;
}

async function addAuditLog(
  result: ReadyContact,
  eventType: string
) {
  const { error } =
    await supabaseAdmin
      .from("phone_contact_access_logs")
      .insert({
        booking_id: result.booking.id,
        viewer_profile_id:
          result.viewerProfileId,
        contact_profile_id:
          result.otherProfile.id,
        event_type: eventType,
      });

  if (error) {
    throw new Error(
      "Journal de securite indisponible : " +
        error.message
    );
  }
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const startedAt =
    Date.now();

  try {
    const { id: bookingId } =
      await context.params;

    const result =
      await resolveContact(
        request,
        bookingId
      );

    if (isDenied(result)) {
      return result.response;
    }

    return NextResponse.json({
      contactAllowed: true,
      canReveal: true,
      otherName: result.otherName,
      phoneNumber: null,
      accessExpiresAt:
        result.accessExpiresAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Contact KLYX indisponible.";

    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "booking_contact_read_failed",
      route:
        "/api/bookings/[id]/contact",
      method: "GET",
      status,
      code:
        "booking_contact_read_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const startedAt =
    Date.now();

  try {
    const { id: bookingId } =
      await context.params;

    const result =
      await resolveContact(
        request,
        bookingId
      );

    if (isDenied(result)) {
      return result.response;
    }

    await addAuditLog(
      result,
      "phone_explicit_reveal"
    );

    return NextResponse.json({
      contactAllowed: true,
      canReveal: true,
      revealed: true,
      audited: true,
      otherName: result.otherName,
      phoneNumber: result.phoneNumber,
      verified: true,
      accessExpiresAt:
        result.accessExpiresAt,
      displayExpiresAt:
        displayExpiresAt(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Revelation impossible.";

    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "booking_contact_reveal_failed",
      route:
        "/api/bookings/[id]/contact",
      method: "POST",
      status,
      code:
        "booking_contact_reveal_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const startedAt =
    Date.now();

  try {
    const { id: bookingId } =
      await context.params;

    const result =
      await resolveContact(
        request,
        bookingId
      );

    if (isDenied(result)) {
      return result.response;
    }

    await addAuditLog(
      result,
      "phone_call_started"
    );

    return NextResponse.json({
      callAllowed: true,
      audited: true,
      phoneNumber: result.phoneNumber,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Appel KLYX impossible.";

    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "booking_contact_call_failed",
      route:
        "/api/bookings/[id]/contact",
      method: "PUT",
      status,
      code:
        "booking_contact_call_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

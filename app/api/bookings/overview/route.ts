// KLYX_BOOKING_OVERVIEW_CURRENCY_INTEGRITY_PHASE_5G
import {
  NextResponse,
} from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

import {
  secureApiErrorResponse,
} from "@/lib/api-error";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_BOOKINGS_GROUP_OVERVIEW_API_12_92

type Role =
  | "client"
  | "provider";

type BookingRow = {
  id: string;
  parent_id: string;

  provider_id:
    | string
    | null;

  babysitter_id:
    | string
    | null;

  service_id:
    | string
    | null;

  booking_group_id:
    | string
    | null;

  group_position:
    | number
    | null;

  booking_date:
    string;

  start_time:
    string;

  end_time:
    string;

  status:
    string;

  payment_status:
    | string
    | null;

  service_status:
    | string
    | null;

  amount_total:
    | number
    | null;

  estimated_amount_cents:
    | number
    | null;

  currency:
    | string
    | null;

  created_at:
    string;
};

type GroupRow = {
  id: string;

  client_profile_id:
    string;

  provider_profile_id:
    string;

  status:
    string;

  payment_status:
    string;

  total_amount_cents:
    number;

  currency:
    string;

  slot_count:
    number;

  cancellation_request_status:
    string;

  cancellation_requested_by:
    | string
    | null;

  cancellation_resolution:
    string;

  refund_status:
    string;

  refunded_amount_cents:
    | number
    | null;

  created_at:
    string;

  updated_at:
    string;
};

type ProfileRow = {
  id: string;

  first_name:
    | string
    | null;

  last_name:
    | string
    | null;

  avatar_url:
    | string
    | null;
};

type ServiceRow = {
  id: string;
  slug: string;

  name:
    | string
    | null;
};

export type BookingOverviewCard = {
  id: string;

  entityType:
    | "booking"
    | "group";

  href: string;

  role: Role;

  otherUserName:
    string;

  otherUserAvatar:
    | string
    | null;

  serviceLabel:
    string;

  status:
    string;

  statusLabel:
    string;

  paymentStatus:
    string;

  amountCents:
    | number
    | null;

  currency:
    string;

  dateFrom:
    string;

  dateTo:
    string;

  firstStart:
    string;

  lastEnd:
    string;

  slotCount:
    number;

  actionRequired:
    boolean;

  history:
    boolean;

  cancellationPending:
    boolean;

  refundStatus:
    string;

  createdAt:
    string;
};

function providerId(
  booking: BookingRow
) {
  return (
    booking.provider_id ??
    booking.babysitter_id ??
    null
  );
}

function roleForBooking(
  booking: BookingRow,
  profileId: string
): Role {
  return booking.parent_id ===
    profileId
    ? "client"
    : "provider";
}

function roleForGroup(
  group: GroupRow,
  profileId: string
): Role {
  return group.client_profile_id ===
    profileId
    ? "client"
    : "provider";
}

function displayName(
  profile:
    | ProfileRow
    | undefined
) {
  if (!profile) {
    return "Utilisateur KLYX";
  }

  return (
    [
      profile.first_name,
      profile.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Utilisateur KLYX"
  );
}

function serviceLabel(
  service:
    | ServiceRow
    | undefined
) {
  if (!service) {
    return "Service KLYX";
  }

  if (
    service.name
      ?.trim()
  ) {
    return service.name.trim();
  }

  const labels:
    Record<
      string,
      string
    > = {
      babysitting:
        "Baby-sitting",

      cleaning:
        "Menage",

      moving:
        "Demenagement",

      handyman:
        "Bricolage",
    };

  return (
    labels[
      service.slug
    ] ??
    service.slug ??
    "Service KLYX"
  );
}

function groupStatus(
  group: GroupRow,
  profileId: string
) {
  if (
    group.refund_status ===
    "failed"
  ) {
    return {
      status:
        "refund_failed",

      label:
        "Remboursement a verifier",
    };
  }

  if (
    group.refund_status ===
    "processing"
  ) {
    return {
      status:
        "refund_processing",

      label:
        "Remboursement en cours",
    };
  }

  if (
    group.refund_status ===
      "refunded" ||
    group.payment_status ===
      "refunded"
  ) {
    return {
      status:
        "refunded",

      label:
        "Remboursee",
    };
  }

  if (
    group.cancellation_request_status ===
    "requested"
  ) {
    const requester =
      group.cancellation_requested_by ===
      profileId;

    return {
      status:
        requester
          ? "cancellation_waiting"
          : "cancellation_decision",

      label:
        requester
          ? "Annulation en attente"
          : "Decision requise",
    };
  }

  if (
    group.status ===
    "pending_provider"
  ) {
    return {
      status:
        "pending",

      label:
        "En attente",
    };
  }

  if (
    group.status ===
    "accepted"
  ) {
    if (
      group.payment_status !==
      "paid"
    ) {
      return {
        status:
          "payment_pending",

        label:
          "Paiement a finaliser",
      };
    }

    return {
      status:
        "accepted",

      label:
        "Confirmee",
    };
  }

  if (
    group.status ===
    "completed"
  ) {
    return {
      status:
        "completed",

      label:
        "Terminee",
    };
  }

  if (
    group.status ===
    "cancelled"
  ) {
    return {
      status:
        "cancelled",

      label:
        "Annulee",
    };
  }

  if (
    group.status ===
    "rejected"
  ) {
    return {
      status:
        "rejected",

      label:
        "Refusee",
    };
  }

  return {
    status:
      group.status,

    label:
      group.status,
  };
}

function bookingStatus(
  booking: BookingRow
) {
  if (
    booking.status ===
    "accepted" &&
    booking.payment_status !==
    "paid"
  ) {
    return {
      status:
        "payment_pending",

      label:
        "Paiement a finaliser",
    };
  }

  const labels:
    Record<
      string,
      string
    > = {
      pending:
        "En attente",

      accepted:
        "Acceptee",

      rejected:
        "Refusee",

      cancelled:
        "Annulee",

      completed:
        "Terminee",
    };

  return {
    status:
      booking.status,

    label:
      labels[
        booking.status
      ] ??
      booking.status,
  };
}

function groupNeedsAction(
  group: GroupRow,
  profileId: string
) {
  const role =
    roleForGroup(
      group,
      profileId
    );

  if (
    group.refund_status ===
    "failed"
  ) {
    return true;
  }

  if (
    group.cancellation_request_status ===
    "requested"
  ) {
    return (
      group.cancellation_requested_by !==
      profileId
    );
  }

  if (
    role ===
      "provider" &&
    group.status ===
      "pending_provider"
  ) {
    return true;
  }

  if (
    role ===
      "client" &&
    group.status ===
      "accepted" &&
    group.payment_status !==
      "paid"
  ) {
    return true;
  }

  return false;
}

function bookingNeedsAction(
  booking: BookingRow,
  profileId: string
) {
  const role =
    roleForBooking(
      booking,
      profileId
    );

  if (
    role ===
      "provider"
  ) {
    return booking.status ===
      "pending";
  }

  return (
    booking.status ===
      "accepted" &&
    booking.payment_status !==
      "paid"
  );
}

function groupIsHistory(
  group: GroupRow
) {
  return (
    [
      "completed",
      "cancelled",
      "rejected",
    ].includes(
      group.status
    ) ||
    group.refund_status ===
      "refunded"
  );
}

function bookingIsHistory(
  booking: BookingRow
) {
  return [
    "completed",
    "cancelled",
    "rejected",
  ].includes(
    booking.status
  );
}

export async function GET(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    const profileId =
      profile.id;

    const [
      bookingResult,
      groupResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select(
            "id, parent_id, provider_id, babysitter_id, service_id, booking_group_id, group_position, booking_date, start_time, end_time, status, payment_status, service_status, amount_total, estimated_amount_cents, currency, created_at"
          )
          .or(
            "parent_id.eq." +
            profileId +
            ",provider_id.eq." +
            profileId +
            ",babysitter_id.eq." +
            profileId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(200),

        supabaseAdmin
          .from(
            "booking_groups"
          )
          .select(
            "id, client_profile_id, provider_profile_id, status, payment_status, total_amount_cents, currency, slot_count, cancellation_request_status, cancellation_requested_by, cancellation_resolution, refund_status, refunded_amount_cents, created_at, updated_at"
          )
          .or(
            "client_profile_id.eq." +
            profileId +
            ",provider_profile_id.eq." +
            profileId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(100),
      ]);

    if (
      bookingResult.error
    ) {
      throw new Error(
        bookingResult
          .error.message
      );
    }

    if (
      groupResult.error
    ) {
      throw new Error(
        groupResult
          .error.message
      );
    }

    const bookings =
      (
        bookingResult.data ??
        []
      ) as unknown as
        BookingRow[];

    const groups =
      (
        groupResult.data ??
        []
      ) as unknown as
        GroupRow[];

    /*
      KLYX 12.92:
      Les enfants groupes servent encore
      au tracking, ledger et remboursement,
      mais ils ne deviennent jamais des
      cartes individuelles dans /bookings.
    */
    const singleBookings =
      bookings.filter(
        (booking) =>
          !booking.booking_group_id
      );

    const childrenByGroup =
      new Map<
        string,
        BookingRow[]
      >();

    for (
      const booking
      of bookings
    ) {
      if (
        !booking.booking_group_id
      ) {
        continue;
      }

      const current =
        childrenByGroup.get(
          booking.booking_group_id
        ) ??
        [];

      current.push(
        booking
      );

      childrenByGroup.set(
        booking.booking_group_id,
        current
      );
    }

    for (
      const children
      of childrenByGroup.values()
    ) {
      children.sort(
        (
          first,
          second
        ) => {
          const positionA =
            first.group_position ??
            999;

          const positionB =
            second.group_position ??
            999;

          if (
            positionA !==
            positionB
          ) {
            return (
              positionA -
              positionB
            );
          }

          return (
            first.booking_date +
            first.start_time
          ).localeCompare(
            second.booking_date +
            second.start_time
          );
        }
      );
    }

    const profileIds =
      new Set<string>();

    const serviceIds =
      new Set<string>();

    for (
      const booking
      of bookings
    ) {
      profileIds.add(
        booking.parent_id
      );

      const provider =
        providerId(
          booking
        );

      if (provider) {
        profileIds.add(
          provider
        );
      }

      if (
        booking.service_id
      ) {
        serviceIds.add(
          booking.service_id
        );
      }
    }

    for (
      const group
      of groups
    ) {
      profileIds.add(
        group.client_profile_id
      );

      profileIds.add(
        group.provider_profile_id
      );
    }

    let profiles:
      ProfileRow[] =
      [];

    if (
      profileIds.size >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, first_name, last_name, avatar_url"
        )
        .in(
          "id",
          Array.from(
            profileIds
          )
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      profiles =
        (
          data ??
          []
        ) as unknown as
          ProfileRow[];
    }

    let services:
      ServiceRow[] =
      [];

    if (
      serviceIds.size >
      0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from("services")
        .select(
          "id, slug, name"
        )
        .in(
          "id",
          Array.from(
            serviceIds
          )
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      services =
        (
          data ??
          []
        ) as unknown as
          ServiceRow[];
    }

    const profileMap =
      new Map(
        profiles.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    const serviceMap =
      new Map(
        services.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    const cards:
      BookingOverviewCard[] =
      [];

    for (
      const group
      of groups
    ) {
      const children =
        childrenByGroup.get(
          group.id
        ) ??
        [];

      if (
        children.length ===
        0
      ) {
        continue;
      }

      const first =
        children[0];

      const last =
        children[
          children.length -
          1
        ];

      const role =
        roleForGroup(
          group,
          profileId
        );

      const otherId =
        role ===
        "client"
          ? group.provider_profile_id
          : group.client_profile_id;

      const status =
        groupStatus(
          group,
          profileId
        );

      const service =
        first.service_id
          ? serviceMap.get(
              first.service_id
            )
          : undefined;

      cards.push({
        id:
          group.id,

        entityType:
          "group",

        href:
          "/booking-groups/" +
          group.id,

        role,

        otherUserName:
          displayName(
            profileMap.get(
              otherId
            )
          ),

        otherUserAvatar:
          profileMap.get(
            otherId
          )?.avatar_url ??
          null,

        serviceLabel:
          serviceLabel(
            service
          ),

        status:
          status.status,

        statusLabel:
          status.label,

        paymentStatus:
          group.payment_status,

        amountCents:
          Number(
            group.total_amount_cents
          ),

        currency:
          String(group.currency ?? "").trim().toUpperCase(),

        dateFrom:
          first.booking_date,

        dateTo:
          last.booking_date,

        firstStart:
          first.start_time,

        lastEnd:
          last.end_time,

        slotCount:
          Number(
            group.slot_count
          ),

        actionRequired:
          groupNeedsAction(
            group,
            profileId
          ),

        history:
          groupIsHistory(
            group
          ),

        cancellationPending:
          group.cancellation_request_status ===
          "requested",

        refundStatus:
          group.refund_status,

        createdAt:
          group.created_at,
      });
    }

    for (
      const booking
      of singleBookings
    ) {
      const role =
        roleForBooking(
          booking,
          profileId
        );

      const provider =
        providerId(
          booking
        );

      const otherId =
        role ===
        "client"
          ? provider
          : booking.parent_id;

      const service =
        booking.service_id
          ? serviceMap.get(
              booking.service_id
            )
          : undefined;

      const status =
        bookingStatus(
          booking
        );

      cards.push({
        id:
          booking.id,

        entityType:
          "booking",

        href:
          "/bookings/" +
          booking.id,

        role,

        otherUserName:
          otherId
            ? displayName(
                profileMap.get(
                  otherId
                )
              )
            : "Utilisateur KLYX",

        otherUserAvatar:
          otherId
            ? profileMap.get(
                otherId
              )?.avatar_url ??
              null
            : null,

        serviceLabel:
          serviceLabel(
            service
          ),

        status:
          status.status,

        statusLabel:
          status.label,

        paymentStatus:
          booking.payment_status ??
          "unpaid",

        amountCents:
          booking.estimated_amount_cents ??
          booking.amount_total,

        currency:
          String(booking.currency ?? "").trim().toUpperCase(),

        dateFrom:
          booking.booking_date,

        dateTo:
          booking.booking_date,

        firstStart:
          booking.start_time,

        lastEnd:
          booking.end_time,

        slotCount: 1,

        actionRequired:
          bookingNeedsAction(
            booking,
            profileId
          ),

        history:
          bookingIsHistory(
            booking
          ),

        cancellationPending:
          false,

        refundStatus:
          "not_required",

        createdAt:
          booking.created_at,
      });
    }

    cards.sort(
      (
        first,
        second
      ) => {
        if (
          first.actionRequired !==
          second.actionRequired
        ) {
          return first.actionRequired
            ? -1
            : 1;
        }

        return second.createdAt
          .localeCompare(
            first.createdAt
          );
      }
    );

    return NextResponse.json({
      profileId,

      accountType:
        profile.accountType,

      cards,

      count:
        cards.length,

      groupCount:
        cards.filter(
          (card) =>
            card.entityType ===
            "group"
        ).length,

      childBookingsHidden:
        bookings.filter(
          (booking) =>
            Boolean(
              booking.booking_group_id
            )
        ).length,

      groupedDisplay:
        true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les reservations.";

    const status =
      apiErrorStatus(
        message
      );

    return secureApiErrorResponse({
      error,
      event:
        "booking_overview_failed",
      route:
        "/api/bookings/overview",
      method: "GET",
      status,
      code:
        "booking_overview_failed",
      publicMessage:
        status < 500
          ? message
          : undefined,
      startedAt,
    });
  }
}

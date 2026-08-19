import {
  NextResponse,
} from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_FINANCE_AUDIT_API_13_03

type BookingRow = {
  id: string;

  booking_group_id:
    | string
    | null;

  provider_id:
    | string
    | null;

  babysitter_id:
    | string
    | null;
};

type LedgerRow = {
  id: string;

  booking_id:
    string;

  entry_type:
    string;

  status:
    string;

  gross_amount_cents:
    number;

  platform_fee_cents:
    number;

  provider_amount_cents:
    | number
    | null;

  refund_amount_cents:
    number;

  stripe_checkout_session_id:
    | string
    | null;

  stripe_payment_intent_id:
    | string
    | null;

  stripe_refund_id:
    | string
    | null;

  created_at:
    string;
};

type GroupAuditEvent = {
  key: string;

  groupId: string;

  eventType:
    "payment" |
    "refund";

  stripeId:
    string;

  ledgerRows:
    number;

  bookingIds:
    string[];

  grossValues:
    number[];

  providerValues:
    number[];

  refundValues:
    number[];

  sameAmountsRepeated:
    boolean;

  allocatedAmounts:
    boolean;

  suspicious:
    boolean;
};

function moneyValue(
  value: unknown
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? Math.max(
        Math.round(
          number
        ),
        0
      )
    : 0;
}

function distinct(
  values: string[]
) {
  return Array.from(
    new Set(
      values
    )
  );
}

function repeatedPositiveAmounts(
  values: number[]
) {
  const positives =
    values.filter(
      (value) =>
        value > 0
    );

  if (
    positives.length <
    2
  ) {
    return false;
  }

  return (
    new Set(
      positives
    ).size ===
    1
  );
}

function hasAllocatedAmounts(
  values: number[]
) {
  const positives =
    values.filter(
      (value) =>
        value > 0
    );

  return (
    positives.length >
      1 &&
    new Set(
      positives
    ).size >
      1
  );
}

export async function GET(
  request: Request
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "provider"
    );

    const [
      providerBookingsResult,
      legacyBookingsResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from(
            "bookings"
          )
          .select(
            "id, booking_group_id, provider_id, babysitter_id"
          )
          .eq(
            "provider_id",
            profile.id
          ),

        supabaseAdmin
          .from(
            "bookings"
          )
          .select(
            "id, booking_group_id, provider_id, babysitter_id"
          )
          .is(
            "provider_id",
            null
          )
          .eq(
            "babysitter_id",
            profile.id
          ),
      ]);

    if (
      providerBookingsResult.error
    ) {
      throw new Error(
        providerBookingsResult
          .error.message
      );
    }

    if (
      legacyBookingsResult.error
    ) {
      throw new Error(
        legacyBookingsResult
          .error.message
      );
    }

    const bookingMap =
      new Map<
        string,
        BookingRow
      >();

    const rawBookings = [
      ...(
        (
          providerBookingsResult.data ??
          []
        ) as unknown as
          BookingRow[]
      ),

      ...(
        (
          legacyBookingsResult.data ??
          []
        ) as unknown as
          BookingRow[]
      ),
    ];

    for (
      const booking
      of rawBookings
    ) {
      bookingMap.set(
        booking.id,
        booking
      );
    }

    const bookings =
      Array.from(
        bookingMap.values()
      );

    const bookingIds =
      bookings.map(
        (booking) =>
          booking.id
      );

    const groupedBookings =
      bookings.filter(
        (booking) =>
          Boolean(
            booking.booking_group_id
          )
      );

    const groupIds =
      distinct(
        groupedBookings
          .map(
            (booking) =>
              booking.booking_group_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      );

    if (
      bookingIds.length ===
      0
    ) {
      return NextResponse.json({
        auditVersion:
          "13.03",

        readOnly:
          true,

        healthy:
          true,

        summary: {
          bookingCount:
            0,

          bookingGroupCount:
            0,

          ledgerRowCount:
            0,

          groupedLedgerRowCount:
            0,

          distinctGroupPaymentIntents:
            0,

          distinctGroupRefunds:
            0,

          duplicatedStripeEvents:
            0,

          suspiciousPaymentEvents:
            0,

          suspiciousRefundEvents:
            0,
        },

        events:
          [],

        automaticExecutionAllowed:
          false,
      });
    }

    const {
      data:
        ledgerData,

      error:
        ledgerError,
    } = await supabaseAdmin
      .from(
        "booking_financial_ledger"
      )
      .select(
        "id, booking_id, entry_type, status, gross_amount_cents, platform_fee_cents, provider_amount_cents, refund_amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, stripe_refund_id, created_at"
      )
      .in(
        "booking_id",
        bookingIds
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      ledgerError
    ) {
      throw new Error(
        ledgerError.message
      );
    }

    const ledger =
      (
        ledgerData ??
        []
      ) as unknown as
        LedgerRow[];

    const bookingToGroup =
      new Map<
        string,
        string
      >();

    for (
      const booking
      of groupedBookings
    ) {
      if (
        booking.booking_group_id
      ) {
        bookingToGroup.set(
          booking.id,
          booking.booking_group_id
        );
      }
    }

    const groupedLedger =
      ledger.filter(
        (entry) =>
          bookingToGroup.has(
            entry.booking_id
          )
      );

    /*
      Paiement :
      un Stripe PaymentIntent doit representer
      un evenement financier unique.

      Remboursement :
      un Stripe Refund doit egalement rester
      un evenement unique.

      Nous ne supprimons rien ici.
      Nous observons seulement le ledger.
    */
    const buckets =
      new Map<
        string,
        {
          groupId:
            string;

          eventType:
            "payment" |
            "refund";

          stripeId:
            string;

          rows:
            LedgerRow[];
        }
      >();

    for (
      const entry
      of groupedLedger
    ) {
      const groupId =
        bookingToGroup.get(
          entry.booking_id
        );

      if (!groupId) {
        continue;
      }

      let eventType:
        "payment" |
        "refund" |
        null =
        null;

      let stripeId:
        string |
        null =
        null;

      if (
        entry.entry_type ===
          "payment_succeeded" ||
        entry.entry_type ===
          "payment_failed"
      ) {
        eventType =
          "payment";

        stripeId =
          entry.stripe_payment_intent_id ??
          entry.stripe_checkout_session_id;
      }

      if (
        entry.entry_type ===
          "refund_succeeded" ||
        entry.entry_type ===
          "refund_failed"
      ) {
        eventType =
          "refund";

        stripeId =
          entry.stripe_refund_id;
      }

      if (
        !eventType ||
        !stripeId
      ) {
        continue;
      }

      const key =
        groupId +
        ":" +
        eventType +
        ":" +
        stripeId;

      const existing =
        buckets.get(
          key
        );

      if (existing) {
        existing.rows.push(
          entry
        );
      } else {
        buckets.set(
          key,
          {
            groupId,
            eventType,
            stripeId,
            rows: [
              entry,
            ],
          }
        );
      }
    }

    const events:
      GroupAuditEvent[] =
      [];

    for (
      const [
        key,
        bucket,
      ]
      of buckets
    ) {
      const bookingIdsForEvent =
        distinct(
          bucket.rows.map(
            (row) =>
              row.booking_id
          )
        );

      const grossValues =
        bucket.rows.map(
          (row) =>
            moneyValue(
              row.gross_amount_cents
            )
        );

      const providerValues =
        bucket.rows.map(
          (row) =>
            moneyValue(
              row.provider_amount_cents
            )
        );

      const refundValues =
        bucket.rows.map(
          (row) =>
            moneyValue(
              row.refund_amount_cents
            )
        );

      const amountBasis =
        bucket.eventType ===
          "refund"
          ? refundValues
          : grossValues;

      const sameAmountsRepeated =
        repeatedPositiveAmounts(
          amountBasis
        );

      const allocatedAmounts =
        hasAllocatedAmounts(
          amountBasis
        );

      /*
        Plus d une ligne avec le meme identifiant Stripe
        n est pas automatiquement une erreur :
        les montants peuvent etre repartis par enfant.

        Suspicious = meme identifiant Stripe +
        plusieurs bookings +
        meme montant positif repete.
      */
      const suspicious =
        bucket.rows.length >
          1 &&
        bookingIdsForEvent.length >
          1 &&
        sameAmountsRepeated;

      events.push({
        key,

        groupId:
          bucket.groupId,

        eventType:
          bucket.eventType,

        stripeId:
          bucket.stripeId,

        ledgerRows:
          bucket.rows.length,

        bookingIds:
          bookingIdsForEvent,

        grossValues,

        providerValues,

        refundValues,

        sameAmountsRepeated,

        allocatedAmounts,

        suspicious,
      });
    }

    events.sort(
      (
        first,
        second
      ) => {
        if (
          first.suspicious !==
          second.suspicious
        ) {
          return first.suspicious
            ? -1
            : 1;
        }

        return (
          second.ledgerRows -
          first.ledgerRows
        );
      }
    );

    const duplicatedStripeEvents =
      events.filter(
        (event) =>
          event.ledgerRows >
          1
      );

    const suspiciousPaymentEvents =
      events.filter(
        (event) =>
          event.eventType ===
            "payment" &&
          event.suspicious
      );

    const suspiciousRefundEvents =
      events.filter(
        (event) =>
          event.eventType ===
            "refund" &&
          event.suspicious
      );

    const distinctGroupPaymentIntents =
      new Set(
        groupedLedger
          .map(
            (entry) =>
              entry.stripe_payment_intent_id
          )
          .filter(
            Boolean
          )
      ).size;

    const distinctGroupRefunds =
      new Set(
        groupedLedger
          .map(
            (entry) =>
              entry.stripe_refund_id
          )
          .filter(
            Boolean
          )
      ).size;

    const suspiciousCount =
      suspiciousPaymentEvents.length +
      suspiciousRefundEvents.length;

    return NextResponse.json({
      auditVersion:
        "13.03",

      readOnly:
        true,

      healthy:
        suspiciousCount ===
        0,

      summary: {
        bookingCount:
          bookings.length,

        bookingGroupCount:
          groupIds.length,

        ledgerRowCount:
          ledger.length,

        groupedLedgerRowCount:
          groupedLedger.length,

        distinctGroupPaymentIntents,

        distinctGroupRefunds,

        duplicatedStripeEvents:
          duplicatedStripeEvents.length,

        suspiciousPaymentEvents:
          suspiciousPaymentEvents.length,

        suspiciousRefundEvents:
          suspiciousRefundEvents.length,
      },

      events:
        events.slice(
          0,
          100
        ),

      /*
        Aucun montant n est modifie automatiquement.
      */
      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Audit financier KLYX impossible.";

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}
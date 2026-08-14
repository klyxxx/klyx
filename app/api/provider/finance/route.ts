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

// KLYX_GROUP_AWARE_FINANCE_COUNTS_13_04
// KLYX_GROUP_CANONICAL_FINANCE_13_05
// KLYX_GROUP_SCHEMA_RUNTIME_FINANCE_13_05C

type BookingRow = {
  id:
    string;

  provider_id:
    | string
    | null;

  babysitter_id:
    | string
    | null;

  booking_group_id:
    | string
    | null;

  booking_date:
    string;

  status:
    string;
};

type BookingGroupRow = {
  id:
    string;

  provider_profile_id?:
    string;

  [key: string]:
    unknown;
};

type LedgerRow = {
  id:
    string;

  booking_id:
    string;

  entry_type:
    string;

  status:
    string;

  currency:
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

  payment_mode:
    | string
    | null;

  stripe_checkout_session_id:
    | string
    | null;

  stripe_payment_intent_id:
    | string
    | null;

  stripe_refund_id:
    | string
    | null;

  failure_code:
    | string
    | null;

  failure_message:
    | string
    | null;

  created_at:
    string;

  updated_at:
    string;
};

type CanonicalTotal = {
  cents:
    number;

  column:
    string;
};

const GROUP_TOTAL_CANDIDATES:
  Array<{
    column:
      string;

    storedAsCents:
      boolean;
  }> = [
    {
      column:
        "total_amount_cents",

      storedAsCents:
        true,
    },
    {
      column:
        "amount_total_cents",

      storedAsCents:
        true,
    },
    {
      column:
        "group_total_cents",

      storedAsCents:
        true,
    },
    {
      column:
        "total_cents",

      storedAsCents:
        true,
    },
    {
      column:
        "total_amount",

      storedAsCents:
        false,
    },
    {
      column:
        "amount_total",

      storedAsCents:
        false,
    },
    {
      column:
        "total_price",

      storedAsCents:
        false,
    },
    {
      column:
        "group_total",

      storedAsCents:
        false,
    },
    {
      column:
        "amount",

      storedAsCents:
        false,
    },
    {
      column:
        "total",

      storedAsCents:
        false,
    },
  ];

function safeNumber(
  value:
    unknown
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return parsed;
}

function cents(
  value:
    unknown
): number {
  const parsed =
    safeNumber(
      value
    );

  if (
    parsed ===
    null
  ) {
    return 0;
  }

  return Math.max(
    Math.round(
      parsed
    ),
    0
  );
}

function eurosToCents(
  value:
    unknown
): number {
  const parsed =
    safeNumber(
      value
    );

  if (
    parsed ===
    null
  ) {
    return 0;
  }

  return Math.max(
    Math.round(
      parsed *
      100
    ),
    0
  );
}

function canonicalGroupTotal(
  group:
    BookingGroupRow
): CanonicalTotal | null {
  for (
    const candidate
    of GROUP_TOTAL_CANDIDATES
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        group,
        candidate.column
      )
    ) {
      continue;
    }

    const raw =
      group[
        candidate.column
      ];

    const amount =
      candidate.storedAsCents
        ? cents(
            raw
          )
        : eurosToCents(
            raw
          );

    if (
      amount >
      0
    ) {
      return {
        cents:
          amount,

        column:
          candidate.column,
      };
    }
  }

  return null;
}

function distinct(
  values:
    string[]
): string[] {
  return Array.from(
    new Set(
      values
    )
  );
}

function financialEventId(
  entry:
    LedgerRow
): string {
  if (
    entry.entry_type ===
      "refund_succeeded" ||
    entry.entry_type ===
      "refund_failed"
  ) {
    return (
      entry.stripe_refund_id ??
      "ledger-" +
        entry.id
    );
  }

  return (
    entry.stripe_payment_intent_id ??
    entry.stripe_checkout_session_id ??
    "ledger-" +
      entry.id
  );
}

function financialEventKey(
  entry:
    LedgerRow,

  booking:
    | BookingRow
    | undefined
): string {
  const scope =
    booking?.booking_group_id
      ? "group:" +
        booking.booking_group_id
      : "booking:" +
        entry.booking_id;

  return (
    scope +
    ":" +
    entry.entry_type +
    ":" +
    financialEventId(
      entry
    )
  );
}

function uniqueFinancialEvents(
  entries:
    LedgerRow[],

  bookingById:
    Map<
      string,
      BookingRow
    >
): number {
  const keys =
    new Set<
      string
    >();

  for (
    const entry
    of entries
  ) {
    keys.add(
      financialEventKey(
        entry,
        bookingById.get(
          entry.booking_id
        )
      )
    );
  }

  return keys.size;
}

function groupIdsForLedger(
  entries:
    LedgerRow[],

  bookingById:
    Map<
      string,
      BookingRow
    >
): string[] {
  return distinct(
    entries
      .map(
        (entry) =>
          bookingById.get(
            entry.booking_id
          )?.booking_group_id ??
          ""
      )
      .filter(
        Boolean
      )
  );
}

function ledgerForGroup(
  entries:
    LedgerRow[],

  groupId:
    string,

  bookingById:
    Map<
      string,
      BookingRow
    >
): LedgerRow[] {
  return entries.filter(
    (entry) =>
      bookingById.get(
        entry.booking_id
      )?.booking_group_id ===
      groupId
  );
}

function sumLedgerField(
  entries:
    LedgerRow[],

  field:
    | "gross_amount_cents"
    | "platform_fee_cents"
    | "provider_amount_cents"
    | "refund_amount_cents"
): number {
  return entries.reduce(
    (
      total,
      entry
    ) =>
      total +
      cents(
        entry[
          field
        ]
      ),
    0
  );
}

function canonicalizeGroupPayment(
  params: {
    canonicalTotalCents:
      number;

    rows:
      LedgerRow[];
  }
) {
  const {
    canonicalTotalCents,
    rows,
  } =
    params;

  const rawGross =
    sumLedgerField(
      rows,
      "gross_amount_cents"
    );

  const rawFee =
    sumLedgerField(
      rows,
      "platform_fee_cents"
    );

  const rawProvider =
    sumLedgerField(
      rows,
      "provider_amount_cents"
    );

  /*
    Cas valide :
      50 + 50 = 100
      canonical = 100
      ratio = 1

    Cas duplique :
      100 + 100 = 200
      canonical = 100
      ratio = 0.5
  */
  const ratio =
    rawGross >
      canonicalTotalCents &&
    rawGross >
      0
      ? canonicalTotalCents /
        rawGross
      : 1;

  const platformFeeCents =
    Math.min(
      canonicalTotalCents,
      Math.max(
        Math.round(
          rawFee *
          ratio
        ),
        0
      )
    );

  let providerAmountCents =
    Math.min(
      canonicalTotalCents,
      Math.max(
        Math.round(
          rawProvider *
          ratio
        ),
        0
      )
    );

  if (
    providerAmountCents ===
      0 &&
    platformFeeCents >
      0
  ) {
    providerAmountCents =
      Math.max(
        canonicalTotalCents -
          platformFeeCents,
        0
      );
  }

  return {
    grossPaidCents:
      canonicalTotalCents,

    platformFeeCents,

    providerAmountCents,

    rawGrossCents:
      rawGross,

    normalizationRatio:
      ratio,
  };
}

export async function GET(
  request:
    Request
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

    const {
      data:
        bookingsData,

      error:
        bookingsError,
    } =
      await supabaseAdmin
        .from(
          "bookings"
        )
        .select(
          "id, provider_id, babysitter_id, booking_group_id, booking_date, status"
        )
        .or(
          "provider_id.eq." +
          profile.id +
          ",babysitter_id.eq." +
          profile.id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      bookingsError
    ) {
      throw new Error(
        bookingsError.message
      );
    }

    const bookings =
      (
        bookingsData ??
        []
      ) as unknown as
        BookingRow[];

    const bookingIds =
      bookings.map(
        (booking) =>
          booking.id
      );

    const groupIds =
      distinct(
        bookings
          .map(
            (booking) =>
              booking.booking_group_id ??
              ""
          )
          .filter(
            Boolean
          )
      );

    if (
      bookingIds.length ===
      0
    ) {
      return NextResponse.json({
        summary: {
          currency:
            "EUR",

          grossPaidCents:
            0,

          platformFeeCents:
            0,

          providerAmountCents:
            0,

          refundedCents:
            0,

          refundsProcessingCents:
            0,

          successfulPayments:
            0,

          failedPayments:
            0,

          successfulRefunds:
            0,

          processingRefundEvents:
            0,

          rawSuccessfulPaymentRows:
            0,

          rawFailedPaymentRows:
            0,

          rawSuccessfulRefundRows:
            0,

          canonicalGroupPayments:
            0,

          canonicalGroupRefunds:
            0,

          groupPaymentFallbacks:
            0,

          groupRefundFallbacks:
            0,

          detectedGroupTotalColumns:
            [],

          countsGroupAware:
            true,

          amountsCanonicalized:
            true,

          amountAggregation:
            "runtime_group_total_plus_single_ledger",
        },

        transactions:
          [],

        financeSemantics: {
          paymentIntentEqualsOneEvent:
            true,

          refundEqualsOneEvent:
            true,

          bookingGroupEqualsOneCommercialScope:
            true,

          groupTotalDetectedAtRuntime:
            true,

          childAllocationDoesNotInflateSummary:
            true,

          amountsCanonicalized:
            true,
        },

        automaticExecutionAllowed:
          false,
      });
    }

    const {
      data:
        ledgerData,

      error:
        ledgerError,
    } =
      await supabaseAdmin
        .from(
          "booking_financial_ledger"
        )
        .select(
          "id, booking_id, entry_type, status, currency, gross_amount_cents, platform_fee_cents, provider_amount_cents, refund_amount_cents, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id, stripe_refund_id, failure_code, failure_message, created_at, updated_at"
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

    let bookingGroups:
      BookingGroupRow[] =
      [];

    if (
      groupIds.length >
      0
    ) {
      /*
        IMPORTANT 13.05c

        Aucun nom de montant n'est impose ici.
        Le vrai schema booking_groups est lu.
      */
      const {
        data:
          groupData,

        error:
          groupError,
      } =
        await supabaseAdmin
          .from(
            "booking_groups"
          )
          .select(
            "*"
          )
          .in(
            "id",
            groupIds
          );

      if (
        groupError
      ) {
        throw new Error(
          groupError.message
        );
      }

      bookingGroups =
        (
          groupData ??
          []
        ) as unknown as
          BookingGroupRow[];
    }

    const bookingById =
      new Map<
        string,
        BookingRow
      >(
        bookings.map(
          (booking) => [
            booking.id,
            booking,
          ]
        )
      );

    const groupById =
      new Map<
        string,
        BookingGroupRow
      >(
        bookingGroups.map(
          (group) => [
            group.id,
            group,
          ]
        )
      );

    const successfulPaymentRows =
      ledger.filter(
        (entry) =>
          entry.entry_type ===
            "payment_succeeded" &&
          entry.status ===
            "succeeded"
      );

    const failedPaymentRows =
      ledger.filter(
        (entry) =>
          entry.entry_type ===
            "payment_failed" &&
          entry.status ===
            "failed"
      );

    const successfulRefundRows =
      ledger.filter(
        (entry) =>
          entry.entry_type ===
            "refund_succeeded" &&
          entry.status ===
            "succeeded"
      );

    const processingRefundRows =
      ledger.filter(
        (entry) =>
          entry.entry_type ===
            "refund_succeeded" &&
          entry.status ===
            "processing"
      );

    // ========================================================
    // COUNTS 13.04
    // ========================================================

    const successfulPayments =
      uniqueFinancialEvents(
        successfulPaymentRows,
        bookingById
      );

    const failedPayments =
      uniqueFinancialEvents(
        failedPaymentRows,
        bookingById
      );

    const successfulRefunds =
      uniqueFinancialEvents(
        successfulRefundRows,
        bookingById
      );

    const processingRefundEvents =
      uniqueFinancialEvents(
        processingRefundRows,
        bookingById
      );

    // ========================================================
    // BOOKINGS SIMPLES
    // ========================================================

    const singlePaymentRows =
      successfulPaymentRows.filter(
        (entry) =>
          !bookingById.get(
            entry.booking_id
          )?.booking_group_id
      );

    const singleRefundRows =
      successfulRefundRows.filter(
        (entry) =>
          !bookingById.get(
            entry.booking_id
          )?.booking_group_id
      );

    const singleProcessingRefundRows =
      processingRefundRows.filter(
        (entry) =>
          !bookingById.get(
            entry.booking_id
          )?.booking_group_id
      );

    let grossPaidCents =
      sumLedgerField(
        singlePaymentRows,
        "gross_amount_cents"
      );

    let platformFeeCents =
      sumLedgerField(
        singlePaymentRows,
        "platform_fee_cents"
      );

    let providerAmountCents =
      sumLedgerField(
        singlePaymentRows,
        "provider_amount_cents"
      );

    let refundedCents =
      sumLedgerField(
        singleRefundRows,
        "refund_amount_cents"
      );

    let refundsProcessingCents =
      sumLedgerField(
        singleProcessingRefundRows,
        "refund_amount_cents"
      );

    // ========================================================
    // GROUPES
    // ========================================================

    let canonicalGroupPayments =
      0;

    let canonicalGroupRefunds =
      0;

    let groupPaymentFallbacks =
      0;

    let groupRefundFallbacks =
      0;

    const detectedColumns =
      new Set<
        string
      >();

    const paidGroupIds =
      groupIdsForLedger(
        successfulPaymentRows,
        bookingById
      );

    for (
      const groupId
      of paidGroupIds
    ) {
      const group =
        groupById.get(
          groupId
        );

      const rows =
        ledgerForGroup(
          successfulPaymentRows,
          groupId,
          bookingById
        );

      const canonical =
        group
          ? canonicalGroupTotal(
              group
            )
          : null;

      if (
        canonical &&
        canonical.cents >
          0
      ) {
        detectedColumns.add(
          canonical.column
        );

        const allocation =
          canonicalizeGroupPayment({
            canonicalTotalCents:
              canonical.cents,

            rows,
          });

        grossPaidCents +=
          allocation.grossPaidCents;

        platformFeeCents +=
          allocation.platformFeeCents;

        providerAmountCents +=
          allocation.providerAmountCents;

        canonicalGroupPayments +=
          1;

        continue;
      }

      /*
        Fallback conservateur :
        anciennes donnees sans total groupe reconnu.
      */
      grossPaidCents +=
        sumLedgerField(
          rows,
          "gross_amount_cents"
        );

      platformFeeCents +=
        sumLedgerField(
          rows,
          "platform_fee_cents"
        );

      providerAmountCents +=
        sumLedgerField(
          rows,
          "provider_amount_cents"
        );

      groupPaymentFallbacks +=
        1;
    }

    const refundedGroupIds =
      groupIdsForLedger(
        successfulRefundRows,
        bookingById
      );

    for (
      const groupId
      of refundedGroupIds
    ) {
      const group =
        groupById.get(
          groupId
        );

      const rows =
        ledgerForGroup(
          successfulRefundRows,
          groupId,
          bookingById
        );

      const rawRefund =
        sumLedgerField(
          rows,
          "refund_amount_cents"
        );

      const canonical =
        group
          ? canonicalGroupTotal(
              group
            )
          : null;

      if (
        canonical &&
        canonical.cents >
          0
      ) {
        detectedColumns.add(
          canonical.column
        );

        /*
          Un refund partiel reel de 30 EUR
          sur un groupe de 100 EUR reste 30.

          Un doublon 100 + 100 reste 100.
        */
        refundedCents +=
          Math.min(
            canonical.cents,
            rawRefund
          );

        canonicalGroupRefunds +=
          1;

        continue;
      }

      refundedCents +=
        rawRefund;

      groupRefundFallbacks +=
        1;
    }

    const processingGroupIds =
      groupIdsForLedger(
        processingRefundRows,
        bookingById
      );

    for (
      const groupId
      of processingGroupIds
    ) {
      const group =
        groupById.get(
          groupId
        );

      const rows =
        ledgerForGroup(
          processingRefundRows,
          groupId,
          bookingById
        );

      const rawProcessing =
        sumLedgerField(
          rows,
          "refund_amount_cents"
        );

      const canonical =
        group
          ? canonicalGroupTotal(
              group
            )
          : null;

      if (
        canonical &&
        canonical.cents >
          0
      ) {
        detectedColumns.add(
          canonical.column
        );

        refundsProcessingCents +=
          Math.min(
            canonical.cents,
            rawProcessing
          );

        continue;
      }

      refundsProcessingCents +=
        rawProcessing;
    }

    const currency =
      successfulPaymentRows[0]
        ?.currency ||
      ledger[0]
        ?.currency ||
      "EUR";

    const rawTransactions13_11 =
      ledger
        .slice(
          0,
          100
        )
        .map(
          (entry) => {
            const booking =
              bookingById.get(
                entry.booking_id
              );

            return {
              id:
                entry.id,

              bookingId:
                entry.booking_id,

              bookingGroupId:
                booking?.booking_group_id ??
                null,

              grouped:
                Boolean(
                  booking?.booking_group_id
                ),

              financialEventKey:
                financialEventKey(
                  entry,
                  booking
                ),

              bookingDate:
                booking?.booking_date ??
                null,

              bookingStatus:
                booking?.status ??
                null,

              entryType:
                entry.entry_type,

              status:
                entry.status,

              currency:
                entry.currency ||
                "EUR",

              grossAmountCents:
                cents(
                  entry.gross_amount_cents
                ),

              platformFeeCents:
                cents(
                  entry.platform_fee_cents
                ),

              providerAmountCents:
                entry.provider_amount_cents ==
                null
                  ? null
                  : cents(
                      entry.provider_amount_cents
                    ),

              refundAmountCents:
                cents(
                  entry.refund_amount_cents
                ),

              paymentMode:
                entry.payment_mode,

              stripePaymentIntentId:
                entry.stripe_payment_intent_id,

              stripeRefundId:
                entry.stripe_refund_id,

              failureCode:
                entry.failure_code,

              failureMessage:
                entry.failure_message,

              createdAt:
                entry.created_at,
            };
          }
        );


// KLYX_CANONICAL_FINANCE_TRANSACTIONS_13_11

    type CommercialTransaction13_11 =
      (typeof rawTransactions13_11)[number];

    const commercialBuckets13_11 =
      new Map<
        string,
        CommercialTransaction13_11[]
      >();

    const commercialSingles13_11:
      CommercialTransaction13_11[] =
      [];

    for (
      const transaction
      of rawTransactions13_11
    ) {
      if (
        !transaction.bookingGroupId
      ) {
        commercialSingles13_11.push(
          transaction
        );

        continue;
      }

      /*
        financialEventKey est deja group-aware
        depuis 13.04 :

        group:<groupId>:<entryType>:<stripeEvent>

        Les allocations enfants appartenant au
        meme evenement commercial tombent donc
        dans le meme bucket.
      */
      const key =
        transaction.financialEventKey;

      const current =
        commercialBuckets13_11.get(
          key
        ) ??
        [];

      current.push(
        transaction
      );

      commercialBuckets13_11.set(
        key,
        current
      );
    }

    const commercialGroups13_11:
      CommercialTransaction13_11[] =
      [];

    for (
      const [
        eventKey,
        rows
      ]
      of commercialBuckets13_11
    ) {
      const first =
        rows[0];

      if (!first) {
        continue;
      }

      const groupId =
        first.bookingGroupId;

      if (!groupId) {
        continue;
      }

      const group =
        groupById.get(
          groupId
        );

      const canonical =
        group
          ? canonicalGroupTotal(
              group
            )
          : null;

      const rawGross =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            cents(
              row.grossAmountCents
            ),
          0
        );

      const rawFee =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            cents(
              row.platformFeeCents
            ),
          0
        );

      const rawProvider =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            cents(
              row.providerAmountCents
            ),
          0
        );

      const rawRefund =
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            cents(
              row.refundAmountCents
            ),
          0
        );

      let grossAmountCents =
        rawGross;

      let platformFeeCents =
        rawFee;

      let providerAmountCents:
        number | null =
        rawProvider;

      let refundAmountCents =
        rawRefund;

      /*
        Le snapshot groupe reste la limite
        commerciale canonique.

        Exemple legitime :
        50 + 50 = 100
        => reste 100.

        Exemple duplique :
        100 + 100 = 200
        total groupe = 100
        => UI commerciale = 100.
      */
      if (
        canonical &&
        canonical.cents >
          0
      ) {
        if (
          first.entryType ===
            "payment_succeeded" &&
          first.status ===
            "succeeded"
        ) {
          const ratio =
            rawGross >
              canonical.cents &&
            rawGross >
              0
              ? canonical.cents /
                rawGross
              : 1;

          grossAmountCents =
            canonical.cents;

          platformFeeCents =
            Math.min(
              canonical.cents,
              Math.max(
                Math.round(
                  rawFee *
                  ratio
                ),
                0
              )
            );

          providerAmountCents =
            Math.min(
              canonical.cents,
              Math.max(
                Math.round(
                  rawProvider *
                  ratio
                ),
                0
              )
            );

          if (
            providerAmountCents ===
              0 &&
            platformFeeCents >
              0
          ) {
            providerAmountCents =
              Math.max(
                canonical.cents -
                  platformFeeCents,
                0
              );
          }
        }
        else if (
          first.entryType ===
            "refund_succeeded"
        ) {
          refundAmountCents =
            Math.min(
              canonical.cents,
              rawRefund
            );

          grossAmountCents =
            Math.min(
              canonical.cents,
              rawGross
            );
        }
        else {
          grossAmountCents =
            Math.min(
              canonical.cents,
              rawGross
            );

          refundAmountCents =
            Math.min(
              canonical.cents,
              rawRefund
            );
        }
      }

      const newestCreatedAt =
        rows
          .map(
            (row) =>
              row.createdAt
          )
          .filter(
            Boolean
          )
          .sort()
          .reverse()[0] ??
        first.createdAt;

      commercialGroups13_11.push({
        ...first,

        id:
          "commercial-" +
          groupId +
          "-" +
          eventKey,

        grouped:
          true,

        grossAmountCents,

        platformFeeCents,

        providerAmountCents,

        refundAmountCents,

        createdAt:
          newestCreatedAt,

        financialEventKey:
          eventKey,
      });
    }

    /*
      IMPORTANT 13.11

      transactions =
      vue commerciale prestataire.

      Le ledger brut reste intact en DB
      et reste consultable via l'audit 13.03.
    */
    // KLYX_CANONICAL_FINANCE_RECONCILIATION_13_12

    const commercialTransactionsAll13_12 =
      [
        ...commercialSingles13_11,
        ...commercialGroups13_11,
      ]
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
        );

    /*
      L'interface conserve seulement
      les 100 transactions les plus recentes.

      La reconciliation utilise TOUTES
      les transactions commerciales.
    */
    const transactions =
      commercialTransactionsAll13_12
        .slice(
          0,
          100
        );

    let reconciledGrossPaidCents13_12 =
      0;

    let reconciledPlatformFeeCents13_12 =
      0;

    let reconciledProviderAmountCents13_12 =
      0;

    let reconciledRefundedCents13_12 =
      0;

    let reconciledProcessingRefundCents13_12 =
      0;

    for (
      const transaction
      of commercialTransactionsAll13_12
    ) {
      if (
        transaction.entryType ===
          "payment_succeeded" &&
        transaction.status ===
          "succeeded"
      ) {
        reconciledGrossPaidCents13_12 +=
          cents(
            transaction.grossAmountCents
          );

        reconciledPlatformFeeCents13_12 +=
          cents(
            transaction.platformFeeCents
          );

        reconciledProviderAmountCents13_12 +=
          cents(
            transaction.providerAmountCents
          );

        continue;
      }

      if (
        transaction.entryType ===
          "refund_succeeded" &&
        transaction.status ===
          "succeeded"
      ) {
        reconciledRefundedCents13_12 +=
          cents(
            transaction.refundAmountCents
          );

        continue;
      }

      if (
        transaction.entryType ===
          "refund_succeeded" &&
        transaction.status ===
          "processing"
      ) {
        reconciledProcessingRefundCents13_12 +=
          cents(
            transaction.refundAmountCents
          );
      }
    }

    const reconciliationDifferences13_12 = {
      grossPaidCents:
        reconciledGrossPaidCents13_12 -
        grossPaidCents,

      platformFeeCents:
        reconciledPlatformFeeCents13_12 -
        platformFeeCents,

      providerAmountCents:
        reconciledProviderAmountCents13_12 -
        providerAmountCents,

      refundedCents:
        reconciledRefundedCents13_12 -
        refundedCents,

      refundsProcessingCents:
        reconciledProcessingRefundCents13_12 -
        refundsProcessingCents,
    };

    const reconciliationOk13_12 =
      Object.values(
        reconciliationDifferences13_12
      ).every(
        (difference) =>
          difference ===
          0
      );

    const reconciliation = {
      checked:
        true,

      reconciled:
        reconciliationOk13_12,

      status:
        reconciliationOk13_12
          ? "ok"
          : "review_required",

      source:
        "canonical_summary_vs_commercial_transactions",

      canonicalSummary: {
        grossPaidCents,

        platformFeeCents,

        providerAmountCents,

        refundedCents,

        refundsProcessingCents,
      },

      commercialTransactions: {
        grossPaidCents:
          reconciledGrossPaidCents13_12,

        platformFeeCents:
          reconciledPlatformFeeCents13_12,

        providerAmountCents:
          reconciledProviderAmountCents13_12,

        refundedCents:
          reconciledRefundedCents13_12,

        refundsProcessingCents:
          reconciledProcessingRefundCents13_12,
      },

      differenceCents:
        reconciliationDifferences13_12,

      commercialEventsChecked:
        commercialTransactionsAll13_12.length,

      commercialEventsReturned:
        transactions.length,

      historyTruncatedForDisplay:
        commercialTransactionsAll13_12.length >
        transactions.length,

      readOnly:
        true,

      ledgerModified:
        false,

      stripeModified:
        false,

      automaticCorrection:
        false,
    };

    return NextResponse.json({
      summary: {
        currency,

        grossPaidCents,

        platformFeeCents,

        providerAmountCents,

        refundedCents,

        refundsProcessingCents,

        successfulPayments,

        failedPayments,

        successfulRefunds,

        processingRefundEvents,

        rawSuccessfulPaymentRows:
          successfulPaymentRows.length,

        rawFailedPaymentRows:
          failedPaymentRows.length,

        rawSuccessfulRefundRows:
          successfulRefundRows.length,

        canonicalGroupPayments,

        canonicalGroupRefunds,

        groupPaymentFallbacks,

        groupRefundFallbacks,

        detectedGroupTotalColumns:
          Array.from(
            detectedColumns
          ),

        countsGroupAware:
          true,

        amountsCanonicalized:
          true,

        amountAggregation:
          "runtime_group_total_plus_single_ledger",
      },

      transactions,


      reconciliation,
      financeSemantics: {
        paymentIntentEqualsOneEvent:
          true,

        refundEqualsOneEvent:
          true,

        bookingGroupEqualsOneCommercialScope:
          true,

        groupTotalDetectedAtRuntime:
          true,

        childAllocationDoesNotInflateSummary:
          true,

        partialExternalRefundCannotBeOverstated:
          true,

        amountsCanonicalized:
          true,
      },

      automaticExecutionAllowed:
        false,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les finances.";

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
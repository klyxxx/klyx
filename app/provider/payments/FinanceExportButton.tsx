// KLYX_FINANCE_EXPORT_CURRENCY_PHASE_5G
"use client";

import {
  useState,
} from "react";

import {
  Download,
  LoaderCircle,
} from "lucide-react";

import {
  supabase,
} from "@/lib/supabase";

// KLYX_CANONICAL_FINANCE_EXPORT_UI_13_14

type FinanceTransaction = {
  id: string;

  bookingId:
    string;

  bookingGroupId:
    string | null;

  grouped:
    boolean;

  financialEventKey:
    string;

  bookingDate:
    string | null;

  bookingStatus:
    string | null;

  entryType:
    string;

  status:
    string;

  currency:
    string;

  grossAmountCents:
    number;

  platformFeeCents:
    number;

  providerAmountCents:
    number | null;

  refundAmountCents:
    number;

  paymentMode:
    string | null;

  stripePaymentIntentId:
    string | null;

  stripeRefundId:
    string | null;

  failureCode:
    string | null;

  failureMessage:
    string | null;

  createdAt:
    string;
};

type Reconciliation = {
  checked:
    boolean;

  reconciled:
    boolean;

  status:
    string;

  commercialEventsChecked:
    number;

  historyTruncatedForDisplay:
    boolean;

  readOnly:
    boolean;

  ledgerModified:
    boolean;

  stripeModified:
    boolean;

  automaticCorrection:
    boolean;
};

type FinanceSummary = {
  currency?:
    string;

  grossPaidCents?:
    number;

  platformFeeCents?:
    number;

  providerAmountCents?:
    number;

  refundedCents?:
    number;

  refundsProcessingCents?:
    number;
};

type FinanceResponse = {
  summary?:
    FinanceSummary;

  transactions?:
    FinanceTransaction[];

  reconciliation?:
    Reconciliation;

  error?:
    string;
};

function csvCell(
  value:
    unknown
): string {
  const text =
    value ===
      null ||
    value ===
      undefined
      ? ""
      : String(
          value
        );

  return (
    '"' +
    text.replace(
      /"/g,
      '""'
    ) +
    '"'
  );
}

function csvRow(
  values:
    unknown[]
): string {
  return values
    .map(
      csvCell
    )
    .join(
      ";"
    );
}

function amount(
  cents:
    number |
    null |
    undefined
): string {
  const safe =
    Number.isFinite(
      Number(
        cents
      )
    )
      ? Number(
          cents
        )
      : 0;

  return (
    safe /
    100
  ).toFixed(
    2
  );
}

function exportDateLabel(): string {
  const now =
    new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() +
      1
    ).padStart(
      2,
      "0"
    ),
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}

export default function FinanceExportButton() {
  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  async function exportFinance() {
    setBusy(
      true
    );

    setErrorMessage(
      ""
    );

    try {
      const {
        data:
          sessionData,
      } =
        await supabase.auth.getSession();

      const accessToken =
        sessionData.session?.access_token;

      if (
        !accessToken
      ) {
        throw new Error(
          "Session KLYX manquante."
        );
      }

      /*
        Source unique :
        API finance canonique 13.11 + 13.12.

        L'audit brut 13.03 n'est jamais
        utilise pour cet export commercial.
      */
      const response =
        await fetch(
          "/api/provider/finance",
          {
            cache:
              "no-store",

            headers: {
              Authorization:
                "Bearer " +
                accessToken,
            },
          }
        );

      const body =
        (
          await response.json()
        ) as FinanceResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          body.error ||
          "Export financier impossible."
        );
      }

      const transactions =
        Array.isArray(
          body.transactions
        )
          ? body.transactions
          : [];

      const summary =
        body.summary ??
        {};

      const reconciliation =
        body.reconciliation;

      const rows:
        string[] =
        [];

      /*
        UTF-8 + separateur point-virgule :
        pratique pour Excel en configuration
        francophone.
      */
      rows.push(
        csvRow([
          "KLYX",
          "Export financier commercial",
        ])
      );

      rows.push(
        csvRow([
          "Date export",
          new Date()
            .toISOString(),
        ])
      );

      rows.push(
        csvRow([
          "Devise",
          summary.currency?.trim().toUpperCase() || "NON_DEFINIE",
        ])
      );

      rows.push(
        csvRow([
          "Reconciliation",
          reconciliation?.reconciled
            ? "OK"
            : "A VERIFIER",
        ])
      );

      rows.push(
        csvRow([
          "Etat reconciliation",
          reconciliation?.status ??
          "indisponible",
        ])
      );

      rows.push(
        csvRow([
          "Evenements commerciaux verifies",
          reconciliation?.commercialEventsChecked ??
          0,
        ])
      );

      rows.push(
        csvRow([
          "Montant brut total",
          amount(
            summary.grossPaidCents
          ),
        ])
      );

      rows.push(
        csvRow([
          "Commission KLYX totale",
          amount(
            summary.platformFeeCents
          ),
        ])
      );

      rows.push(
        csvRow([
          "Montant prestataire total",
          amount(
            summary.providerAmountCents
          ),
        ])
      );

      rows.push(
        csvRow([
          "Remboursements",
          amount(
            summary.refundedCents
          ),
        ])
      );

      rows.push(
        ""
      );

      rows.push(
        csvRow([
          "Transaction",
          "Mission",
          "Groupe",
          "Mission groupee",
          "Date mission",
          "Etat mission",
          "Type",
          "Etat financier",
          "Devise",
          "Montant brut",
          "Commission KLYX",
          "Montant prestataire",
          "Remboursement",
          "Mode paiement",
          "PaymentIntent Stripe",
          "Refund Stripe",
          "Date evenement",
        ])
      );

      for (
        const transaction
        of transactions
      ) {
        rows.push(
          csvRow([
            transaction.id,

            transaction.bookingId,

            transaction.bookingGroupId ??
            "",

            transaction.grouped
              ? "OUI"
              : "NON",

            transaction.bookingDate ??
            "",

            transaction.bookingStatus ??
            "",

            transaction.entryType,

            transaction.status,

            transaction.currency,

            amount(
              transaction.grossAmountCents
            ),

            amount(
              transaction.platformFeeCents
            ),

            amount(
              transaction.providerAmountCents
            ),

            amount(
              transaction.refundAmountCents
            ),

            transaction.paymentMode ??
            "",

            transaction.stripePaymentIntentId ??
            "",

            transaction.stripeRefundId ??
            "",

            transaction.createdAt,
          ])
        );
      }

      const csv =
        "\uFEFF" +
        rows.join(
          "\r\n"
        );

      const blob =
        new Blob(
          [
            csv,
          ],
          {
            type:
              "text/csv;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        "klyx-finances-" +
        exportDateLabel() +
        ".csv";

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(
        url
      );
    }
    catch (
      error
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Export financier impossible."
      );
    }
    finally {
      setBusy(
        false
      );
    }
  }

  return (
    <section className="klyx-card mt-6 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="klyx-eyebrow">
            Documents financiers
          </p>

          <h2 className="mt-2 text-xl font-black">
            Export financier KLYX
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Télécharge les transactions commerciales canoniques visibles dans KLYX. Une mission groupée reste une seule transaction commerciale.
          </p>
        </div>

        <button
          type="button"
          disabled={
            busy
          }
          onClick={
            () =>
              void exportFinance()
          }
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle
              className="animate-spin"
              size={18}
            />
          ) : (
            <Download
              size={18}
            />
          )}

          {busy
            ? "Préparation..."
            : "Exporter en CSV"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Export manuel uniquement. Le fichier ne modifie ni Stripe, ni le ledger financier, ni les réservations.
      </p>
    </section>
  );
}
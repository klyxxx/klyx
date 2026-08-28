// KLYX_FINANCE_EXPORT_CURRENCY_PHASE_5G
"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxProviderFinance,
  type KlyxProviderFinanceMessageKey,
  type KlyxProviderFinanceMessageValues,
} from "@/lib/klyx-provider-finance-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_CANONICAL_FINANCE_EXPORT_UI_13_14

type FinanceTransaction = {
  id: string;
  bookingId: string;
  bookingGroupId: string | null;
  grouped: boolean;
  financialEventKey: string;
  bookingDate: string | null;
  bookingStatus: string | null;
  entryType: string;
  status: string;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  providerAmountCents: number | null;
  refundAmountCents: number;
  paymentMode: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
};

type Reconciliation = {
  checked: boolean;
  reconciled: boolean;
  status: string;
  commercialEventsChecked: number;
  historyTruncatedForDisplay: boolean;
  readOnly: boolean;
  ledgerModified: boolean;
  stripeModified: boolean;
  automaticCorrection: boolean;
};

type FinanceSummary = {
  currency?: string;
  grossPaidCents?: number;
  platformFeeCents?: number;
  providerAmountCents?: number;
  refundedCents?: number;
  refundsProcessingCents?: number;
};

type FinanceResponse = {
  summary?: FinanceSummary;
  transactions?: FinanceTransaction[];
  reconciliation?: Reconciliation;
  error?: string;
};

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(";");
}

function amount(cents: number | null | undefined): string {
  const safe = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return (safe / 100).toFixed(2);
}

function exportDateLabel(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function FinanceExportButton() {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxProviderFinanceMessageKey,
    values: KlyxProviderFinanceMessageValues = {}
  ) => translateKlyxProviderFinance(locale, key, values);

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function exportFinance() {
    setBusy(true);
    setErrorMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("KLYX_AUTH_REQUIRED");
      }

      /*
        Source unique: API finance canonique 13.11 + 13.12.
        L'audit brut 13.03 n'est jamais utilisé pour cet export commercial.
      */
      const response = await fetch("/api/provider/finance", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const body = (await response.json()) as FinanceResponse;

      if (!response.ok) {
        throw new Error("KLYX_FINANCE_EXPORT_FAILED");
      }

      const transactions = Array.isArray(body.transactions)
        ? body.transactions
        : [];
      const summary = body.summary ?? {};
      const reconciliation = body.reconciliation;
      const rows: string[] = [];

      rows.push(csvRow(["KLYX", t("csvCommercialExport")]));
      rows.push(csvRow([t("csvExportDate"), new Date().toISOString()]));
      rows.push(
        csvRow([
          t("csvCurrency"),
          summary.currency?.trim().toUpperCase() || t("csvUndefined"),
        ])
      );
      rows.push(
        csvRow([
          t("csvReconciliation"),
          reconciliation?.reconciled ? "OK" : t("csvReview"),
        ])
      );
      rows.push(
        csvRow([
          t("csvReconciliationState"),
          reconciliation?.status ?? t("csvUnavailable"),
        ])
      );
      rows.push(
        csvRow([
          t("csvCommercialEventsChecked"),
          reconciliation?.commercialEventsChecked ?? 0,
        ])
      );
      rows.push(csvRow([t("csvGrossTotal"), amount(summary.grossPaidCents)]));
      rows.push(
        csvRow([t("csvPlatformFeeTotal"), amount(summary.platformFeeCents)])
      );
      rows.push(
        csvRow([t("csvProviderTotal"), amount(summary.providerAmountCents)])
      );
      rows.push(csvRow([t("csvRefunds"), amount(summary.refundedCents)]));
      rows.push("");
      rows.push(
        csvRow([
          t("csvTransaction"),
          t("csvMission"),
          t("csvGroup"),
          t("csvGroupedMission"),
          t("csvMissionDate"),
          t("csvMissionStatus"),
          t("csvType"),
          t("csvFinancialStatus"),
          t("csvCurrency"),
          t("csvGrossAmount"),
          t("platformFee"),
          t("csvProviderAmount"),
          t("csvRefund"),
          t("csvPaymentMode"),
          "PaymentIntent Stripe",
          "Refund Stripe",
          t("csvEventDate"),
        ])
      );

      for (const transaction of transactions) {
        rows.push(
          csvRow([
            transaction.id,
            transaction.bookingId,
            transaction.bookingGroupId ?? "",
            transaction.grouped ? t("csvYes") : t("csvNo"),
            transaction.bookingDate ?? "",
            transaction.bookingStatus ?? "",
            transaction.entryType,
            transaction.status,
            transaction.currency,
            amount(transaction.grossAmountCents),
            amount(transaction.platformFeeCents),
            amount(transaction.providerAmountCents),
            amount(transaction.refundAmountCents),
            transaction.paymentMode ?? "",
            transaction.stripePaymentIntentId ?? "",
            transaction.stripeRefundId ?? "",
            transaction.createdAt,
          ])
        );
      }

      const csv = `\uFEFF${rows.join("\r\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `klyx-finances-${exportDateLabel()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage(t("genericExportError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="klyx-card mt-6 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="klyx-eyebrow">{t("exportEyebrow")}</p>
          <h2 className="mt-2 text-xl font-black">{t("exportTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("exportDescription")}
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void exportFinance()}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          {busy ? t("exportPreparing") : t("exportCsv")}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        {t("exportReadOnly")}
      </p>
    </section>
  );
}

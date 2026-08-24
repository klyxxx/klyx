// KLYX_SPLIT_REFUND_CURRENCY_PHASE_5G
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxSplitMissionRefundStatusLocale,
  translateKlyxSplitMissionRefundStatus,
  type KlyxSplitMissionRefundStatusMessageKey,
} from "@/lib/klyx-split-mission-refund-status-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_REFUND_STATUS_UI_13_28
// KLYX_SPLIT_MISSION_REFUND_STATUS_I18N

type RefundUnit = {
  id: string;
  providerId: string;
  amountCents: number;
  currency: string;
  paymentStatus: string;
  refundStatus: string;
  refundedAmountCents: number;
  fullyRefunded: boolean;
  refundFailureReason: string | null;
};

type Result = {
  paymentRunExists?: boolean;
  runStatus?: string;
  totalAmountCents?: number;
  totalRefundedAmountCents?: number;
  currency?: string;
  paymentUnitCount?: number;
  refundedUnitCount?: number;
  refundInProgress?: boolean;
  refundFailure?: boolean;
  units?: RefundUnit[];
  error?: string;
};

const NUMBER_FORMAT_LOCALES = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
} as const;

function money(
  cents: number,
  currency: string,
  locale: keyof typeof NUMBER_FORMAT_LOCALES,
  currencyUnavailable: string
): string {
  const code = currency?.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    return `${(cents / 100).toFixed(2)} · ${currencyUnavailable}`;
  }

  return new Intl.NumberFormat(NUMBER_FORMAT_LOCALES[locale], {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}

function refundLabel(
  value: string,
  t: (key: KlyxSplitMissionRefundStatusMessageKey) => string
): string {
  if (value === "refunded") {
    return t("statusRefunded");
  }

  if (value === "partially_refunded") {
    return t("statusPartiallyRefunded");
  }

  if (value === "processing") {
    return t("statusProcessing");
  }

  if (value === "failed") {
    return t("statusFailed");
  }

  return t("statusNone");
}

export default function SplitMissionRefundStatus({
  batchId,
}: {
  batchId: string;
}) {
  const { locale } = useKlyxLocale();
  const presentationLocale = resolveKlyxSplitMissionRefundStatusLocale(locale);
  const t = useCallback(
    (key: KlyxSplitMissionRefundStatusMessageKey) =>
      translateKlyxSplitMissionRefundStatus(locale, key),
    [locale]
  );

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const accessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = await accessToken();
      if (!token) {
        setErrorMessage(t("sessionMissing"));
        return;
      }

      const response = await fetch(
        "/api/bookings/split-missions/" +
          encodeURIComponent(batchId) +
          "/refund-status",
        {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const body = (await response.json()) as Result;
      if (!response.ok) {
        setErrorMessage(t("loadError"));
        return;
      }

      setResult(body);
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, batchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle size={20} className="animate-spin text-violet-500" />
        <p className="text-sm font-bold text-muted-foreground">{t("loading")}</p>
      </section>
    );
  }

  if (!result?.paymentRunExists && !errorMessage) {
    return null;
  }

  const units = result?.units ?? [];
  const currency = result?.currency?.trim().toUpperCase() ?? "";
  const formatMoney = (cents: number, code: string) =>
    money(cents, code, presentationLocale, t("currencyUnavailable"));

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-2 text-xl font-black">{t("title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-black"
        >
          <RefreshCw size={16} />
          {t("refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">{t("totalMission")}</p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(result?.totalAmountCents ?? 0, currency)}
          </p>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">{t("refunded")}</p>
          <p className="mt-2 text-xl font-black">
            {formatMoney(result?.totalRefundedAmountCents ?? 0, currency)}
          </p>
        </div>

        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-black text-muted-foreground">{t("refundedUnits")}</p>
          <p className="mt-2 text-2xl font-black">
            {result?.refundedUnitCount ?? 0}/{result?.paymentUnitCount ?? 0}
          </p>
        </div>
      </div>

      {units.length > 0 && (
        <div className="mt-6 grid gap-3">
          {units.map((unit, index) => (
            <article key={unit.id} className="rounded-2xl border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-muted-foreground">
                    {t("provider")} {index + 1}
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {refundLabel(unit.refundStatus, t)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("refunded")}</p>
                  <p className="mt-1 font-black">
                    {formatMoney(unit.refundedAmountCents, unit.currency)}{" / "}
                    {formatMoney(unit.amountCents, unit.currency)}
                  </p>
                </div>
              </div>

              {unit.refundFailureReason && (
                <p className="mt-3 text-sm font-semibold text-rose-600">
                  {t("failureReasonHidden")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {result?.refundInProgress && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <RotateCcw size={21} className="shrink-0 text-amber-600" />
          <div>
            <p className="font-black">{t("inProgressTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("inProgressDescription")}
            </p>
          </div>
        </div>
      )}

      {result?.refundFailure && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <AlertTriangle size={21} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-black">{t("failureTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("failureDescription")}
            </p>
          </div>
        </div>
      )}

      {units.length > 0 && units.every((unit) => unit.fullyRefunded) && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-black">{t("fullyRefundedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fullyRefundedDescription")}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm font-semibold">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex gap-3 border-t border-border pt-5">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-violet-500" />
        <p className="text-xs leading-5 text-muted-foreground">{t("safetySummary")}</p>
      </div>
    </section>
  );
}

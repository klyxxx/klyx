"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeEuro,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxSplitMissionPriceConfirmationLocale,
  translateKlyxSplitMissionPriceConfirmation,
  type KlyxSplitMissionPriceConfirmationMessageKey,
} from "@/lib/klyx-split-mission-price-confirmation-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_PRICE_CONFIRMATION_UI_13_23
// KLYX_SPLIT_MISSION_PRICE_CONFIRMATION_I18N

type PriceItem = {
  slotId: string;
  position: number;
  bookingId: string;
  providerId: string;
  amountCents: number;
  currency: string;
  budgetMaxCents: number | null;
  overBudget: boolean;
};

type PriceResult = {
  confirmed?: boolean;
  confirmationId?: string | null;
  confirmedAt?: string | null;
  canConfirm?: boolean;
  allProvidersAccepted?: boolean;
  completePriceData?: boolean;
  technicalMismatch?: boolean;
  priceChangedAfterConfirmation?: boolean;
  reconfirmationRequired?: boolean;
  missingPriceCount?: number;
  missingCurrencyCount?: number;
  mixedCurrency?: boolean;
  currency?: string | null;
  totalAmountCents?: number;
  overBudgetCount?: number;
  items?: PriceItem[];
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
  locale: keyof typeof NUMBER_FORMAT_LOCALES
): string {
  return new Intl.NumberFormat(NUMBER_FORMAT_LOCALES[locale], {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export default function SplitMissionPriceConfirmation({
  batchId,
}: {
  batchId: string;
}) {
  const { locale } = useKlyxLocale();
  const presentationLocale = resolveKlyxSplitMissionPriceConfirmationLocale(locale);
  const t = useCallback(
    (key: KlyxSplitMissionPriceConfirmationMessageKey) =>
      translateKlyxSplitMissionPriceConfirmation(locale, key),
    [locale]
  );

  const [result, setResult] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [overBudgetAccepted, setOverBudgetAccepted] = useState(false);

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
          "/prices",
        {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const body = (await response.json()) as PriceResult;
      if (!response.ok) {
        setErrorMessage(t("loadError"));
        return;
      }

      setResult(body);
      if (body.confirmed) {
        setOverBudgetAccepted(true);
      }
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, batchId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => result?.items ?? [], [result]);

  async function confirmPrices() {
    if (busy || !result?.canConfirm) {
      return;
    }

    setBusy(true);
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
          "/prices",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            priceConfirmed: true,
            overBudgetAcknowledged: overBudgetAccepted,
          }),
        }
      );

      await response.json();
      if (!response.ok) {
        setErrorMessage(t("confirmError"));
        return;
      }

      await load();
    } catch {
      setErrorMessage(t("confirmError"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle className="animate-spin text-violet-500" size={20} />
        <p className="text-sm font-bold text-muted-foreground">{t("loading")}</p>
      </section>
    );
  }

  const currency = result?.currency ?? "";
  const overBudgetCount = result?.overBudgetCount ?? 0;

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

      {result?.priceChangedAfterConfirmation && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <AlertTriangle className="shrink-0 text-amber-600" size={20} />
          <div>
            <p className="font-black">{t("changedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("changedDescription")}
            </p>
          </div>
        </div>
      )}

      {result?.technicalMismatch && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <AlertTriangle className="shrink-0 text-rose-600" size={20} />
          <p className="text-sm font-semibold">{t("technicalMismatch")}</p>
        </div>
      )}

      {!result?.allProvidersAccepted && !result?.technicalMismatch && (
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <p className="font-black">{t("acceptanceIncompleteTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("acceptanceIncompleteDescription")}
          </p>
        </div>
      )}

      {(result?.missingPriceCount ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">{t("missingPriceTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("missingPriceDescription")}
          </p>
        </div>
      )}

      {(result?.missingCurrencyCount ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">{t("missingCurrencyTitle")}</p>
        </div>
      )}

      {result?.mixedCurrency && (
        <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <p className="font-black">{t("mixedCurrencyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("mixedCurrencyDescription")}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 grid gap-3">
          {items.map((item) => (
            <article
              key={item.slotId}
              className="rounded-2xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-muted-foreground">
                    {t("slot")} {item.position}
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {money(item.amountCents, item.currency, presentationLocale)}
                  </p>
                </div>

                {item.budgetMaxCents !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("planBudget")}</p>
                    <p className="font-black">
                      {money(item.budgetMaxCents, item.currency, presentationLocale)}
                    </p>
                  </div>
                )}
              </div>

              {item.overBudget && (
                <p className="mt-3 text-sm font-black text-rose-600">
                  {t("overBudgetItem")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {currency && result?.totalAmountCents != null && (
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-muted-foreground">
            <BadgeEuro size={17} />
            {t("totalRecorded")}
          </p>
          <p className="mt-2 text-3xl font-black">
            {money(result.totalAmountCents, currency, presentationLocale)}
          </p>
        </div>
      )}

      {overBudgetCount > 0 && !result?.confirmed && (
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <input
            type="checkbox"
            checked={overBudgetAccepted}
            onChange={(event) => setOverBudgetAccepted(event.target.checked)}
            className="mt-1"
          />
          <span>
            <strong>{t("overBudgetConsent")}</strong>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("overBudgetCountPrefix")}{overBudgetCount} {t("overBudgetCountSuffix")}
            </span>
          </span>
        </label>
      )}

      {result?.confirmed ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck className="shrink-0 text-emerald-600" size={22} />
          <div>
            <p className="font-black">{t("confirmedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("confirmedDescription")}
            </p>
          </div>
        </div>
      ) : result?.canConfirm ? (
        <button
          type="button"
          disabled={busy || (overBudgetCount > 0 && !overBudgetAccepted)}
          onClick={() => void confirmPrices()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white disabled:opacity-50 sm:w-auto"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <LockKeyhole size={18} />
          )}
          {t("confirmButton")}
        </button>
      ) : null}

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex gap-3 border-t border-border pt-5">
        <CheckCircle2 className="mt-0.5 shrink-0 text-violet-500" size={18} />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("noPaymentSafety")}
        </p>
      </div>
    </section>
  );
}

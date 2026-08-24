// KLYX_SPLIT_CHECKOUT_CURRENCY_PHASE_5G
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxSplitMissionCheckoutLocale,
  translateKlyxSplitMissionCheckout,
  type KlyxSplitMissionCheckoutMessageKey,
} from "@/lib/klyx-split-mission-checkout-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_CHECKOUT_UI_13_27
// KLYX_SPLIT_MISSION_CHECKOUT_I18N

type Unit = {
  id: string;
  providerId: string;
  amountCents: number;
  currency: string;
  bookingCount: number;
  status: string;
  checkoutUrl: string | null;
  paid: boolean;
};

type Result = {
  prepared?: boolean;
  status?: string;
  runId?: string;
  totalAmountCents?: number;
  currency?: string;
  paymentUnitCount?: number;
  paidUnitCount?: number;
  units?: Unit[];
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

export default function SplitMissionCheckout({
  batchId,
}: {
  batchId: string;
}) {
  const { locale } = useKlyxLocale();
  const presentationLocale = resolveKlyxSplitMissionCheckoutLocale(locale);
  const t = useCallback(
    (key: KlyxSplitMissionCheckoutMessageKey) =>
      translateKlyxSplitMissionCheckout(locale, key),
    [locale]
  );

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
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
          "/checkout",
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

  async function prepare() {
    if (preparing) {
      return;
    }

    setPreparing(true);
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
          "/checkout",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checkoutPreparationConfirmed: true,
          }),
        }
      );

      const body = (await response.json()) as Result;
      if (!response.ok) {
        setErrorMessage(t("prepareError"));
        return;
      }

      setResult(body);
    } catch {
      setErrorMessage(t("prepareError"));
    } finally {
      setPreparing(false);
    }
  }

  if (loading) {
    return (
      <section className="klyx-card mt-8 flex items-center gap-3 p-6">
        <LoaderCircle size={20} className="animate-spin text-violet-500" />
        <p className="text-sm font-bold text-muted-foreground">{t("loading")}</p>
      </section>
    );
  }

  const units = result?.units ?? [];
  const paidCount = units.filter((unit) => unit.paid).length;
  const formatMoney = (cents: number, currency: string) =>
    money(cents, currency, presentationLocale, t("currencyUnavailable"));

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

      {!result?.prepared ? (
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
          <div className="flex gap-3">
            <LockKeyhole size={21} className="shrink-0 text-violet-600" />
            <div>
              <p className="font-black">{t("lastStepTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("lastStepDescription")}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={preparing}
            onClick={() => void prepare()}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50"
          >
            {preparing ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <CreditCard size={18} />
            )}
            {t("preparePayments")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">{t("payments")}</p>
              <p className="mt-2 text-2xl font-black">{units.length}</p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">{t("confirmed")}</p>
              <p className="mt-2 text-2xl font-black text-emerald-600">{paidCount}</p>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs font-black text-muted-foreground">{t("total")}</p>
              <p className="mt-2 text-xl font-black">
                {formatMoney(result.totalAmountCents ?? 0, result.currency ?? "")}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {units.map((unit, index) => (
              <article key={unit.id} className="rounded-2xl border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-muted-foreground">
                      {t("provider")} {index + 1}
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {formatMoney(unit.amountCents, unit.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {unit.bookingCount} {t("slots")}
                    </p>
                  </div>

                  {unit.paid ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-600">
                      <CheckCircle2 size={15} />
                      {t("paid")}
                    </span>
                  ) : unit.checkoutUrl ? (
                    <a
                      href={unit.checkoutUrl}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"
                    >
                      {t("payProvider")}
                      <ExternalLink size={15} />
                    </a>
                  ) : (
                    <span className="text-xs font-black text-muted-foreground">
                      {t("refreshRequired")}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {units.length > 0 && paidCount === units.length && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-black">{t("missionPaidTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("missionPaidDescription")}
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

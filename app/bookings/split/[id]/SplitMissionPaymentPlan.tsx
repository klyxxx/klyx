// KLYX_SPLIT_PAYMENT_PLAN_CURRENCY_PHASE_5G
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeEuro,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxSplitMissionPaymentPlanLocale,
  translateKlyxSplitMissionPaymentPlan,
  type KlyxSplitMissionPaymentPlanMessageKey,
} from "@/lib/klyx-split-mission-payment-plan-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_PAYMENT_CONTRACT_UI_13_24
// KLYX_SPLIT_MISSION_PAYMENT_PLAN_I18N

type Allocation = {
  providerId: string;
  amountCents: number;
  currency: string;
  bookingIds: string[];
  slotIds: string[];
  slotCount: number;
};

type PaymentPlanResult = {
  strategy?: string;
  architectureVersion?: string;
  paymentPlanReady?: boolean;
  blockReason?: string | null;
  totalAmountCents?: number;
  currency?: string;
  providerCount?: number;
  paymentUnitCount?: number;
  allocations?: Allocation[];
  providerStripeReadinessChecked?: boolean;
  explicitPaymentConfirmationRequired?: boolean;
  automaticPayment?: boolean;
  paymentCreated?: boolean;
  stripeCheckoutCreated?: boolean;
  error?: string;
};

const NUMBER_FORMAT_LOCALES = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
} as const;

export default function SplitMissionPaymentPlan({ batchId }: { batchId: string }) {
  const { locale } = useKlyxLocale();
  const presentationLocale = resolveKlyxSplitMissionPaymentPlanLocale(locale);
  const t = useCallback(
    (key: KlyxSplitMissionPaymentPlanMessageKey) =>
      translateKlyxSplitMissionPaymentPlan(locale, key),
    [locale]
  );

  const [result, setResult] = useState<PaymentPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const accessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const money = useCallback(
    (cents: number, currency: string): string => {
      const code = currency?.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        return `${(cents / 100).toFixed(2)} · ${t("currencyUnavailable")}`;
      }

      return new Intl.NumberFormat(NUMBER_FORMAT_LOCALES[presentationLocale], {
        style: "currency",
        currency: code,
      }).format(cents / 100);
    },
    [presentationLocale, t]
  );

  const blockLabel = useCallback(
    (value: string | null | undefined): string => {
      if (value === "MISSION_STRUCTURE_CHANGED") {
        return t("blockMissionStructureChanged");
      }
      if (value === "PROVIDER_ACCEPTANCE_CHANGED") {
        return t("blockProviderAcceptanceChanged");
      }
      if (value === "LIVE_PRICE_CHANGED") {
        return t("blockLivePriceChanged");
      }
      if (value === "PRICE_PROOF_MISMATCH") {
        return t("blockPriceProofMismatch");
      }
      if (value === "MULTI_PROVIDER_ALLOCATION_REQUIRED") {
        return t("blockMultiProviderAllocationRequired");
      }
      if (value === "PRICE_CONFIRMATION_REQUIRED") {
        return t("blockPriceConfirmationRequired");
      }
      return t("blockDefault");
    },
    [t]
  );

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
          "/payment-plan",
        {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const body = (await response.json()) as PaymentPlanResult;
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

  if (errorMessage) {
    return (
      <section className="mt-8 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-6">
        <CircleAlert size={22} className="text-rose-600" />
        <p className="mt-3 font-black">{t("errorTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw size={16} />
          {t("retry")}
        </button>
      </section>
    );
  }

  const allocations = result?.allocations ?? [];
  const currency = result?.currency?.trim().toUpperCase() ?? "";

  return (
    <section className="klyx-card mt-8 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">KLYX 13.24</p>
          <h2 className="mt-2 text-xl font-black">{t("title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw size={16} />
          {t("refresh")}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <UsersRound size={18} className="text-violet-500" />
          <p className="mt-3 text-xs font-black text-muted-foreground">{t("providers")}</p>
          <p className="mt-1 text-2xl font-black">{result?.providerCount ?? 0}</p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <CreditCard size={18} className="text-violet-500" />
          <p className="mt-3 text-xs font-black text-muted-foreground">{t("paymentUnits")}</p>
          <p className="mt-1 text-2xl font-black">{result?.paymentUnitCount ?? 0}</p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <BadgeEuro size={18} className="text-violet-500" />
          <p className="mt-3 text-xs font-black text-muted-foreground">{t("missionTotal")}</p>
          <p className="mt-1 text-xl font-black">
            {money(result?.totalAmountCents ?? 0, currency)}
          </p>
        </div>
      </div>

      {allocations.length > 0 && (
        <div className="mt-6 grid gap-3">
          {allocations.map((allocation, index) => (
            <article
              key={allocation.providerId}
              className="rounded-2xl border border-border bg-background/60 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    {t("providerPayment")} {index + 1}
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {money(allocation.amountCents, allocation.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("slots")}</p>
                  <p className="mt-1 font-black">{allocation.slotCount}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {result?.paymentPlanReady ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-black">{t("readyTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("readyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <CircleAlert size={22} className="shrink-0 text-amber-600" />
          <div>
            <p className="font-black">{t("blockedTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {blockLabel(result?.blockReason)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <div className="flex gap-3">
          <LockKeyhole size={20} className="shrink-0 text-violet-600" />
          <div>
            <p className="font-black">{t("noPaymentTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("noPaymentDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-violet-500" />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("safetySummary")}
        </p>
      </div>
    </section>
  );
}

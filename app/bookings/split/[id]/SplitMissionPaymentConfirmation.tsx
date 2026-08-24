"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxSplitMissionPaymentConfirmationLocale,
  translateKlyxSplitMissionPaymentConfirmation,
  type KlyxSplitMissionPaymentConfirmationMessageKey,
} from "@/lib/klyx-split-mission-payment-confirmation-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_PAYMENT_CONFIRMATION_UI_13_26
// KLYX_SPLIT_MISSION_PAYMENT_CONFIRMATION_I18N

type PaymentUnit = {
  providerId: string;
  amountCents: number;
  currency: string;
  bookingIds: string[];
  slotIds: string[];
  stripeAccountId: string;
};

type PaymentPlan = {
  providerCount: number;
  paymentUnitCount: number;
  totalAmountCents: number;
  currency: string;
  units: PaymentUnit[];
};

type PaymentConfirmationResult = {
  paymentConfirmationReady?: boolean;
  blockReason?: string | null;
  confirmed?: boolean;
  confirmationId?: string | null;
  paymentPlan?: PaymentPlan | null;
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

export default function SplitMissionPaymentConfirmation({
  batchId,
}: {
  batchId: string;
}) {
  const { locale } = useKlyxLocale();
  const presentationLocale =
    resolveKlyxSplitMissionPaymentConfirmationLocale(locale);
  const t = useCallback(
    (key: KlyxSplitMissionPaymentConfirmationMessageKey) =>
      translateKlyxSplitMissionPaymentConfirmation(locale, key),
    [locale]
  );

  const [result, setResult] = useState<PaymentConfirmationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [amountAcknowledged, setAmountAcknowledged] = useState(false);
  const [splitAcknowledged, setSplitAcknowledged] = useState(false);

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
          "/payment-confirmation",
        {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const body = (await response.json()) as PaymentConfirmationResult;
      if (!response.ok) {
        setErrorMessage(t("loadError"));
        return;
      }

      setResult(body);
      if (body.confirmed) {
        setAmountAcknowledged(true);
        setSplitAcknowledged(true);
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

  function blockLabel(value: string | null | undefined): string {
    if (value === "PRICE_CONFIRMATION_REQUIRED") {
      return t("blockPriceConfirmationRequired");
    }
    if (value === "MISSION_STRUCTURE_CHANGED") {
      return t("blockMissionStructureChanged");
    }
    if (value === "LIVE_PAYMENT_PLAN_CHANGED") {
      return t("blockLivePaymentPlanChanged");
    }
    if (value === "PROVIDER_STRIPE_NOT_READY") {
      return t("blockProviderStripeNotReady");
    }
    if (value === "PROVIDER_STRIPE_LOOKUP_FAILED") {
      return t("blockProviderStripeLookupFailed");
    }
    if (value === "PAYMENT_ALLOCATION_MISMATCH") {
      return t("blockPaymentAllocationMismatch");
    }
    return t("blockDefault");
  }

  async function confirm() {
    if (
      busy ||
      !result?.paymentConfirmationReady ||
      !amountAcknowledged ||
      !splitAcknowledged
    ) {
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
          "/payment-confirmation",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentConfirmed: true,
            finalAmountAcknowledged: true,
            separateProviderPaymentsAcknowledged: true,
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

  const plan = result?.paymentPlan;
  const units = plan?.units ?? [];

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
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-black"
        >
          <RefreshCw size={16} />
          {t("refresh")}
        </button>
      </div>

      {plan && (
        <>
          <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
            <p className="text-sm font-black text-muted-foreground">
              {t("totalAmount")}
            </p>
            <p className="mt-2 text-3xl font-black">
              {money(
                plan.totalAmountCents,
                plan.currency,
                presentationLocale
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.paymentUnitCount} {t("paymentUnits")} · {plan.providerCount}{" "}
              {t("providers")}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {units.map((unit, index) => (
              <article
                key={unit.providerId}
                className="rounded-2xl border border-border bg-background/60 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-muted-foreground">
                      {t("provider")} {index + 1}
                    </p>
                    <p className="mt-1 font-black">
                      {unit.slotIds.length} {t("slots")}
                    </p>
                  </div>
                  <p className="text-lg font-black">
                    {money(
                      unit.amountCents,
                      unit.currency,
                      presentationLocale
                    )}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {!result?.paymentConfirmationReady && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
          <AlertTriangle size={21} className="shrink-0 text-amber-600" />
          <div>
            <p className="font-black">{t("blockedTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {blockLabel(result?.blockReason)}
            </p>
          </div>
        </div>
      )}

      {result?.paymentConfirmationReady && !result.confirmed && (
        <div className="mt-6 grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-5">
            <input
              type="checkbox"
              checked={amountAcknowledged}
              onChange={(event) => setAmountAcknowledged(event.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>{t("amountConsentTitle")}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("amountConsentDescription")}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-5">
            <input
              type="checkbox"
              checked={splitAcknowledged}
              onChange={(event) => setSplitAcknowledged(event.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>{t("splitConsentTitle")}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("splitConsentDescription")}
              </span>
            </span>
          </label>

          <button
            type="button"
            disabled={busy || !amountAcknowledged || !splitAcknowledged}
            onClick={() => void confirm()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white disabled:opacity-50 sm:w-auto"
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <LockKeyhole size={18} />
            )}
            {t("confirmButton")}
          </button>
        </div>
      )}

      {result?.confirmed && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck size={22} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-black">{t("confirmedTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("confirmedDescription")}
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
        <CreditCard size={18} className="mt-0.5 shrink-0 text-violet-500" />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("noDebitSummary")}
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("reconfirmationSummary")}
        </p>
      </div>
    </section>
  );
}

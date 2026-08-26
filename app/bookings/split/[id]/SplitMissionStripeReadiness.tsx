"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  splitMissionStripeBlockMessageKey,
  splitMissionStripeProviderStateMessageKey,
} from "@/lib/klyx-split-mission-stripe-readiness";
import {
  translateKlyxSplitMissionStripeReadiness,
  type KlyxSplitMissionStripeReadinessMessageKey,
} from "@/lib/klyx-split-mission-stripe-readiness-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_SPLIT_STRIPE_READINESS_UI_13_25
// KLYX_SPLIT_MISSION_STRIPE_READINESS_I18N
// KLYX_SPLIT_STRIPE_READINESS_UI_CONTRACT_15_05

type ProviderStripeState =
  | "ready"
  | "missing_profile"
  | "market_not_ready"
  | "missing_account"
  | "restricted"
  | "lookup_failed";

type ProviderStripeResult = {
  providerId: string;
  providerName: string;
  state: ProviderStripeState;
  account: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: number;
  ready: boolean;
};

type StripeReadinessResult = {
  stripeReadinessComplete?: boolean;
  allProvidersStripeReady?: boolean;
  paymentInfrastructureReady?: boolean;
  checkoutReady?: boolean;
  blockReason?: string | null;
  providerCount?: number;
  readyProviderCount?: number;
  providers?: ProviderStripeResult[];
  explicitPaymentConfirmationRequired?: boolean;
  paymentCreated?: boolean;
  error?: string;
};

export default function SplitMissionStripeReadiness({
  batchId,
}: {
  batchId: string;
}) {
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: KlyxSplitMissionStripeReadinessMessageKey) =>
      translateKlyxSplitMissionStripeReadiness(locale, key),
    [locale]
  );

  const [result, setResult] = useState<StripeReadinessResult | null>(null);
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
          "/stripe-readiness",
        {
          cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const body = (await response.json()) as StripeReadinessResult;
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

  function stateLabel(state: ProviderStripeState): string {
    return t(splitMissionStripeProviderStateMessageKey(state));
  }

  function blockLabel(value: string | null | undefined): string {
    return t(splitMissionStripeBlockMessageKey(value));
  }

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
        <ShieldX size={22} className="text-rose-600" />
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

  const providers = result?.providers ?? [];

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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            {t("providersChecked")}
          </p>
          <p className="mt-2 text-2xl font-black">{result?.providerCount ?? 0}</p>
        </div>

        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-black text-muted-foreground">
            {t("readyForStripe")}
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {result?.readyProviderCount ?? 0}
          </p>
        </div>
      </div>

      {providers.length > 0 && (
        <div className="mt-6 grid gap-3">
          {providers.map((provider) => (
            <article
              key={provider.providerId}
              className="rounded-2xl border border-border bg-background/60 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-muted">
                    <UserRound size={20} />
                  </div>
                  <div>
                    <p className="font-black">{provider.providerName}</p>
                    {provider.account && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stripe {provider.account}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={
                    provider.ready
                      ? "rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600"
                      : "rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600"
                  }
                >
                  {stateLabel(provider.state)}
                </span>
              </div>

              {!provider.ready && (
                <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>
                    {t("chargesEnabled")}: {" "}
                    <strong>{provider.chargesEnabled ? t("yes") : t("no")}</strong>
                  </p>
                  <p>
                    {t("payoutsEnabled")}: {" "}
                    <strong>{provider.payoutsEnabled ? t("yes") : t("no")}</strong>
                  </p>
                  <p>
                    {t("detailsComplete")}: {" "}
                    <strong>{provider.detailsSubmitted ? t("yes") : t("no")}</strong>
                  </p>
                  <p>
                    {t("requirementsDue")}: {" "}
                    <strong>{provider.requirementsDue}</strong>
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {result?.checkoutReady ? (
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
          <AlertTriangle size={22} className="shrink-0 text-amber-600" />
          <div>
            <p className="font-black">{t("blockedTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {blockLabel(result?.blockReason)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
        <CreditCard size={20} className="shrink-0 text-violet-600" />
        <div>
          <p className="font-black">{t("noDebitTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("noDebitDescription")}
          </p>
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

"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, LoaderCircle, Scale } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  providerActivityFrequencyLabel,
  providerDeclarationStateLabel,
  providerLegalEligibilityLabel,
  providerLegalMissingDataLabel,
  providerLegalPathLabel,
  providerLegalReasonLabel,
  providerSelfEmploymentCapacityLabel,
  providerStudentContextLabel,
  translateProviderLegalOnboarding,
  type ProviderLegalOnboardingMessageKey,
} from "@/lib/klyx-provider-legal-onboarding-i18n";
import {
  PROVIDER_ACTIVITY_FREQUENCIES,
  PROVIDER_DECLARATION_STATES,
  PROVIDER_LEGAL_PATHS,
  PROVIDER_SELF_EMPLOYMENT_CAPACITIES,
  PROVIDER_STUDENT_CONTEXTS,
  type ProviderActivityFrequency,
  type ProviderDeclarationState,
  type ProviderLegalAuthority,
  type ProviderLegalPath,
  type ProviderSelfEmploymentCapacity,
  type ProviderStudentContext,
} from "@/lib/provider-legal-authority";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_LEGAL_ONBOARDING_20260912

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("SESSION_MISSING");
  }

  return session.access_token;
}

export default function ProviderLegalPage() {
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: ProviderLegalOnboardingMessageKey) =>
      translateProviderLegalOnboarding(locale, key),
    [locale]
  );

  const [authority, setAuthority] = useState<ProviderLegalAuthority | null>(null);
  const [path, setPath] = useState<ProviderLegalPath>("unknown");
  const [studentContext, setStudentContext] =
    useState<ProviderStudentContext>("unknown");
  const [activityFrequency, setActivityFrequency] =
    useState<ProviderActivityFrequency>("unknown");
  const [selfEmploymentCapacity, setSelfEmploymentCapacity] =
    useState<ProviderSelfEmploymentCapacity>("unknown");
  const [enterpriseNumber, setEnterpriseNumber] = useState("");
  const [socialInsuranceFundAffiliation, setSocialInsuranceFundAffiliation] =
    useState<ProviderDeclarationState>("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const applyAuthority = useCallback((next: ProviderLegalAuthority) => {
    setAuthority(next);
    setPath(next.declarations.path);
    setStudentContext(next.declarations.studentContext);
    setActivityFrequency(next.declarations.activityFrequency);
    setSelfEmploymentCapacity(next.declarations.selfEmploymentCapacity);
    setEnterpriseNumber(next.declarations.enterpriseNumber ?? "");
    setSocialInsuranceFundAffiliation(
      next.declarations.socialInsuranceFundAffiliation
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const token = await accessToken();
      const response = await fetch("/api/provider/legal-authority", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        authority?: ProviderLegalAuthority;
      };

      if (!response.ok || !body.authority) {
        throw new Error("LOAD_FAILED");
      }

      applyAuthority(body.authority);
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [applyAuthority, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await accessToken();
      const response = await fetch("/api/provider/legal-authority", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path,
          studentContext,
          activityFrequency,
          selfEmploymentCapacity,
          enterpriseNumber: enterpriseNumber.trim() || null,
          socialInsuranceFundAffiliation,
        }),
      });
      const body = (await response.json()) as {
        authority?: ProviderLegalAuthority;
      };

      if (!response.ok || !body.authority) {
        throw new Error("SAVE_FAILED");
      }

      applyAuthority(body.authority);
      setSuccessMessage(t("saved"));
    } catch {
      setErrorMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const assessment = authority?.assessment ?? null;
  const independent = path === "professional_independent";
  const occasional = path === "occasional";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/onboarding"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t("backToOnboarding")}
      </Link>

      <section className="mt-5 klyx-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
            <Scale size={21} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{t("title")}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("intro")}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>{t("studentWarning")}</p>
        </div>

        {loading ? (
          <div className="mt-8 flex min-h-44 items-center justify-center text-muted-foreground">
            <LoaderCircle className="animate-spin" size={24} />
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            <label className="grid gap-2">
              <span className="text-sm font-black">{t("pathLabel")}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {t("pathHelp")}
              </span>
              <select
                data-testid="provider-legal-path"
                value={path}
                onChange={(event) => setPath(event.target.value as ProviderLegalPath)}
                className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-blue-600"
              >
                {PROVIDER_LEGAL_PATHS.map((value) => (
                  <option key={value} value={value}>
                    {providerLegalPathLabel(locale, value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black">{t("studentLabel")}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {t("studentHelp")}
              </span>
              <select
                value={studentContext}
                onChange={(event) =>
                  setStudentContext(event.target.value as ProviderStudentContext)
                }
                className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-blue-600"
              >
                {PROVIDER_STUDENT_CONTEXTS.map((value) => (
                  <option key={value} value={value}>
                    {providerStudentContextLabel(locale, value)}
                  </option>
                ))}
              </select>
            </label>

            {occasional && (
              <label className="grid gap-2">
                <span className="text-sm font-black">{t("frequencyLabel")}</span>
                <select
                  value={activityFrequency}
                  onChange={(event) =>
                    setActivityFrequency(
                      event.target.value as ProviderActivityFrequency
                    )
                  }
                  className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-blue-600"
                >
                  {PROVIDER_ACTIVITY_FREQUENCIES.map((value) => (
                    <option key={value} value={value}>
                      {providerActivityFrequencyLabel(locale, value)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {independent && (
              <div className="grid gap-5 border-t border-border pt-6">
                <label className="grid gap-2">
                  <span className="text-sm font-black">{t("capacityLabel")}</span>
                  <select
                    value={selfEmploymentCapacity}
                    onChange={(event) =>
                      setSelfEmploymentCapacity(
                        event.target.value as ProviderSelfEmploymentCapacity
                      )
                    }
                    className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-blue-600"
                  >
                    {PROVIDER_SELF_EMPLOYMENT_CAPACITIES.map((value) => (
                      <option key={value} value={value}>
                        {providerSelfEmploymentCapacityLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">
                    {t("enterpriseNumberLabel")}
                  </span>
                  <input
                    value={enterpriseNumber}
                    onChange={(event) => setEnterpriseNumber(event.target.value)}
                    placeholder={t("enterpriseNumberPlaceholder")}
                    autoComplete="off"
                    className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none placeholder:text-muted-foreground focus:border-blue-600"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">{t("socialFundLabel")}</span>
                  <select
                    value={socialInsuranceFundAffiliation}
                    onChange={(event) =>
                      setSocialInsuranceFundAffiliation(
                        event.target.value as ProviderDeclarationState
                      )
                    }
                    className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-blue-600"
                  >
                    {PROVIDER_DECLARATION_STATES.map((value) => (
                      <option key={value} value={value}>
                        {providerDeclarationStateLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-600/90 disabled:opacity-60 sm:w-fit"
            >
              {saving && <LoaderCircle className="animate-spin" size={17} />}
              {saving ? t("saving") : t("save")}
            </button>

            {errorMessage && (
              <p className="text-sm font-semibold text-destructive">{errorMessage}</p>
            )}
            {successMessage && (
              <p className="text-sm font-semibold text-blue-600">{successMessage}</p>
            )}
          </div>
        )}
      </section>

      {assessment && (
        <section className="mt-5 klyx-card p-6 sm:p-8" data-testid="provider-legal-assessment">
          <h2 className="text-xl font-black">{t("assessmentTitle")}</h2>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-border pb-5">
            <span className="text-sm font-bold text-muted-foreground">
              {t("eligibilityLabel")}
            </span>
            <span className="rounded-full border border-border px-3 py-1.5 text-sm font-black">
              {providerLegalEligibilityLabel(locale, assessment.eligibility)}
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-black">
              {assessment.humanReviewRequired ? (
                <AlertTriangle size={17} className="text-amber-600" />
              ) : (
                <CheckCircle2 size={17} className="text-emerald-600" />
              )}
              {assessment.humanReviewRequired
                ? t("reviewRequired")
                : t("reviewNotRequired")}
            </span>
          </div>

          {assessment.missingData.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-black">{t("missingTitle")}</h3>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                {assessment.missingData.map((item) => (
                  <li key={item}>• {providerLegalMissingDataLabel(locale, item)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-black">{t("reasonsTitle")}</h3>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              {assessment.reasons.map((reason) => (
                <li key={reason}>• {providerLegalReasonLabel(locale, reason)}</li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-xs font-semibold text-muted-foreground">
            {assessment.rulesetVersion}
          </p>
        </section>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  explainProviderMatch,
  matchingLevelLabel,
  type MatchingFilters,
} from "@/lib/intelligent-matching";
import {
  formatKlyxCoverageMessage,
  translateKlyxMatchExplanation,
  type KlyxMatchExplanationMessageKey,
} from "@/lib/klyx-match-explanation-i18n";
import type { ProviderSearchItem } from "@/lib/provider-search";
import { supabase } from "@/lib/supabase";
import QuoteRequestButton from "./QuoteRequestButton";

// KLYX_MATCH_EXPLANATION_I18N

type CoverageResult = {
  available?: boolean;
  covered?: boolean | null;
  requestedLocality?: string;
  zoneLocality?: string;
  distanceKm?: number;
  radiusKm?: number;
  remainingKm?: number;
  isPrimary?: boolean;
};

export default function MatchExplanation({
  provider,
  filters,
}: {
  provider: ProviderSearchItem;
  filters: MatchingFilters;
}) {
  const searchParams = useSearchParams();
  const { locale } = useKlyxLocale();
  const [expanded, setExpanded] = useState(false);
  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const t = (key: KlyxMatchExplanationMessageKey) =>
    translateKlyxMatchExplanation(locale, key);

  const explanation = useMemo(
    () => explainProviderMatch(provider, filters, locale),
    [provider, filters, locale]
  );

  const serviceSlug =
    searchParams.get("service")?.trim() || provider.serviceSlug;
  const locality = filters.city.trim();

  useEffect(() => {
    let cancelled = false;

    async function loadCoverage() {
      if (!provider.profileId || !serviceSlug || !locality) {
        setCoverage(null);
        return;
      }

      setLoadingCoverage(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setCoverage(null);
          return;
        }

        const params = new URLSearchParams({
          providerId: provider.profileId,
          service: serviceSlug,
          locality,
        });

        const response = await fetch(
          `/api/search/provider-coverage?${params.toString()}`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const body = (await response.json()) as CoverageResult;
        if (cancelled) return;

        if (!response.ok) {
          setCoverage(null);
          return;
        }

        setCoverage(body);
      } catch {
        if (!cancelled) setCoverage(null);
      } finally {
        if (!cancelled) setLoadingCoverage(false);
      }
    }

    void loadCoverage();
    return () => {
      cancelled = true;
    };
  }, [provider.profileId, serviceSlug, locality]);

  const adjustedScore = useMemo(() => {
    if (!coverage?.available) return explanation.score;
    if (coverage.covered === true) {
      return Math.min(100, explanation.score + 8);
    }
    if (coverage.covered === false) {
      return Math.max(0, explanation.score - 20);
    }
    return explanation.score;
  }, [coverage, explanation.score]);

  const adjustedLevel =
    adjustedScore >= 90
      ? "excellent"
      : adjustedScore >= 75
        ? "strong"
        : adjustedScore >= 55
          ? "possible"
          : "alternative";

  const coverageMessage = coverage?.available
    ? formatKlyxCoverageMessage(locale, {
        covered: coverage.covered === true,
        requestedLocality: coverage.requestedLocality ?? locality,
        zoneLocality: coverage.zoneLocality ?? "",
        distanceKm: coverage.distanceKm ?? 0,
        radiusKm: coverage.radiusKm ?? 0,
      })
    : "";

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[0.06]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white">
            <Sparkles size={18} />
          </span>

          <div>
            <p className="text-sm font-black">
              {adjustedScore}/100 · {matchingLevelLabel(adjustedLevel, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {provider.qualificationLevel === "regulated"
                ? t("regulatedApprovedSummary")
                : t("approvedSummary")}
            </p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="shrink-0 text-muted-foreground" size={18} />
        ) : (
          <ChevronDown className="shrink-0 text-muted-foreground" size={18} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-violet-500/15 p-4">
          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.07] p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400"
                size={16}
              />
              <div>
                <p className="text-xs font-black">{t("qualificationTitle")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {provider.qualificationLabel}
                </p>

                {provider.officialRegistrationLabel && (
                  <p className="mt-2 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
                    {t("officialRequirementPrefix")} {provider.officialRegistrationLabel}
                  </p>
                )}

                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  {t("qualificationDisclaimer")}
                </p>
              </div>
            </div>
          </div>

          {loadingCoverage && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-background/70 p-3 text-xs text-muted-foreground">
              <LoaderCircle className="animate-spin text-violet-600" size={14} />
              {t("coverageLoading")}
            </div>
          )}

          {coverage?.available && (
            <div
              className={`mb-4 rounded-xl border p-3 ${
                coverage.covered
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-amber-500/25 bg-amber-500/10"
              }`}
            >
              <div className="flex items-start gap-2">
                <MapPin
                  className={`mt-0.5 shrink-0 ${
                    coverage.covered ? "text-emerald-600" : "text-amber-600"
                  }`}
                  size={16}
                />

                <div>
                  <p className="text-xs font-black">
                    {coverage.covered
                      ? t("coverageCoveredTitle")
                      : t("coverageOutsideTitle")}
                  </p>

                  {coverageMessage && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {coverageMessage}
                    </p>
                  )}

                  {typeof coverage.distanceKm === "number" &&
                    typeof coverage.radiusKm === "number" && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                        <span>
                          {t("distanceLabel")} ≈ {coverage.distanceKm} km
                        </span>
                        <span>·</span>
                        <span>
                          {t("radiusLabel")} {coverage.radiusKm} km
                        </span>
                        {coverage.covered &&
                          typeof coverage.remainingKm === "number" && (
                            <>
                              <span>·</span>
                              <span>
                                {t("marginLabel")} {coverage.remainingKm} km
                              </span>
                            </>
                          )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {explanation.reasons.length > 0 && (
            <div className="space-y-2">
              {explanation.reasons.map((reason) => (
                <p
                  key={reason}
                  className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
                >
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-500"
                    size={14}
                  />
                  {reason}
                </p>
              ))}
            </div>
          )}

          {explanation.warnings.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {explanation.warnings.map((warning) => (
                <p
                  key={warning}
                  className="flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 shrink-0" size={14} />
                  {warning}
                </p>
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            {t("scoreDisclaimer")}
          </p>
        </div>
      )}

      <div className="border-t border-violet-500/15 p-4">
        <QuoteRequestButton provider={provider} filters={filters} />
      </div>
    </section>
  );
}

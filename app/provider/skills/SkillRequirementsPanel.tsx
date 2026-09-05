"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderSkillMinimumYears,
  translateKlyxProviderSkillProofType,
  translateKlyxProviderSkills,
  type KlyxProviderSkillsMessageKey,
} from "@/lib/klyx-provider-skills-i18n";
import { supabase } from "@/lib/supabase";

type Rule = {
  countryCode: string;
  serviceSlug: string;
  ruleLevel: "self_declared" | "evidence_required" | "regulated";
  requiredProofTypes: string[];
  acceptedProofTypes: string[];
  minimumYearsExperience: number;
  identityRequired: boolean;
  insuranceRequired: boolean;
  officialRegistrationRequired: boolean;
  officialRegistrationLabel: string | null;
  legalNote: string | null;
  sourceUrl: string | null;
};

type Evaluation = {
  ready: boolean;
  missingProofTypes: string[];
  experienceOk: boolean;
  identityOk: boolean;
};

type RequirementResponse = {
  rule?: Rule;
  evaluation?: Evaluation;
};

type Props = {
  userServiceId: string;
  refreshKey: string;
  onReadyChange: (userServiceId: string, ready: boolean) => void;
};

export default function SkillRequirementsPanel({
  userServiceId,
  refreshKey,
  onReadyChange,
}: Props) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderSkillsMessageKey) =>
    translateKlyxProviderSkills(locale, key);

  const [data, setData] = useState<RequirementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("KLYX_PROVIDER_SKILL_REQUIREMENTS_SESSION_MISSING");
        }

        const response = await fetch(
          `/api/provider/skill-requirements?userServiceId=${encodeURIComponent(
            userServiceId
          )}`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const body = (await response.json()) as RequirementResponse;

        if (!response.ok) {
          throw new Error("KLYX_PROVIDER_SKILL_REQUIREMENTS_LOAD_FAILED");
        }

        if (!cancelled) {
          setData(body);
          onReadyChange(userServiceId, body.evaluation?.ready === true);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          onReadyChange(userServiceId, false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // Locale changes presentation only and must not refetch qualification rules.
  }, [userServiceId, refreshKey, onReadyChange]);

  const missing = useMemo(
    () => new Set(data?.evaluation?.missingProofTypes ?? []),
    [data]
  );

  if (loading) {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin" />
          {t("requirementsLoading")}
        </div>
      </section>
    );
  }

  if (error || !data?.rule || !data.evaluation) {
    return (
      <section className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
        <div className="flex gap-3">
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0 text-rose-500"
          />
          <div>
            <p className="text-sm font-black">
              {t("requirementsUnavailableTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("requirementsUnavailableText")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { rule, evaluation } = data;

  return (
    <section
      className={`mt-5 rounded-2xl border p-5 ${
        evaluation.ready
          ? "border-emerald-500/25 bg-emerald-500/10"
          : "border-amber-500/25 bg-amber-500/10"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              evaluation.ready
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-amber-500/15 text-amber-600"
            }`}
          >
            {evaluation.ready ? (
              <CheckCircle2 size={21} />
            ) : (
              <FileCheck2 size={21} />
            )}
          </span>

          <div>
            <p className="font-black">{t("requirementsTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {evaluation.ready
                ? t("requirementsReadyText")
                : t("requirementsIncompleteText")}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
            evaluation.ready
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {evaluation.ready ? t("readyBadge") : t("incompleteBadge")}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <RequirementRow
          label={t("identity")}
          detail={rule.identityRequired ? t("identityRequired") : t("notRequired")}
          ok={!rule.identityRequired || evaluation.identityOk}
        />

        <RequirementRow
          label={t("experience")}
          detail={
            rule.minimumYearsExperience > 0
              ? formatKlyxProviderSkillMinimumYears(
                  locale,
                  rule.minimumYearsExperience
                )
              : t("noMinimum")
          }
          ok={evaluation.experienceOk}
        />

        {rule.insuranceRequired && (
          <RequirementRow
            label={t("insurance")}
            detail={t("insuranceRequired")}
            ok={!missing.has("insurance")}
          />
        )}

        {rule.officialRegistrationRequired && (
          <RequirementRow
            label={t("authorization")}
            detail={
              rule.officialRegistrationLabel || t("professionalLicenseFallback")
            }
            ok={!missing.has("professional_license")}
          />
        )}
      </div>

      {rule.requiredProofTypes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            {t("requiredProofs")}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {rule.requiredProofTypes.map((proof) => {
              const isMissing = missing.has(proof);

              return (
                <span
                  key={proof}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${
                    isMissing
                      ? "bg-rose-500/10 text-rose-600"
                      : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {isMissing ? (
                    <CircleAlert size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {translateKlyxProviderSkillProofType(locale, proof)}
                  {" · "}
                  {isMissing ? t("missing") : t("validated")}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {rule.acceptedProofTypes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            {t("acceptedProofs")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {rule.acceptedProofTypes
              .map((proof) => translateKlyxProviderSkillProofType(locale, proof))
              .join(" · ")}
          </p>
        </div>
      )}

      {rule.ruleLevel === "regulated" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/10 p-4">
          <ShieldCheck
            size={18}
            className="mt-0.5 shrink-0 text-[#2563EB]"
          />
          <div>
            <p className="text-sm font-black">{t("regulatedTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("regulatedText")}
            </p>
          </div>
        </div>
      )}

      {rule.legalNote && (
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {rule.legalNote}
        </p>
      )}
    </section>
  );
}

function RequirementRow({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/55 p-3.5">
      {ok ? (
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-emerald-500"
        />
      ) : (
        <CircleAlert
          size={18}
          className="mt-0.5 shrink-0 text-amber-500"
        />
      )}

      <div>
        <p className="text-sm font-black">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

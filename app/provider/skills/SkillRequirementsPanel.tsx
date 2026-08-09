"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Rule = {
  countryCode: string;
  serviceSlug: string;
  ruleLevel:
    | "self_declared"
    | "evidence_required"
    | "regulated";
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
  error?: string;
};

type Props = {
  userServiceId: string;
  refreshKey: string;
  onReadyChange: (
    userServiceId: string,
    ready: boolean
  ) => void;
};

const PROOF_LABELS: Record<string, string> = {
  diploma: "Diplôme",
  training_certificate: "Certificat de formation",
  professional_license:
    "Licence ou autorisation professionnelle",
  insurance: "Assurance professionnelle",
  experience_reference:
    "Référence d’expérience",
  portfolio:
    "Portfolio / preuve de réalisations",
  other: "Autre justificatif",
};

function proofLabel(value: string) {
  return PROOF_LABELS[value] ?? value;
}

export default function SkillRequirementsPanel({
  userServiceId,
  refreshKey,
  onReadyChange,
}: Props) {
  const [data, setData] =
    useState<RequirementResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Session manquante.");
        }

        const response = await fetch(
          `/api/provider/skill-requirements?userServiceId=${encodeURIComponent(
            userServiceId
          )}`,
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

        const body =
          (await response.json()) as RequirementResponse;

        if (!response.ok) {
          throw new Error(
            body.error ||
              "Chargement des exigences impossible."
          );
        }

        if (!cancelled) {
          setData(body);
          onReadyChange(
            userServiceId,
            body.evaluation?.ready === true
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Chargement impossible."
          );
          onReadyChange(
            userServiceId,
            false
          );
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
  }, [
    userServiceId,
    refreshKey,
    onReadyChange,
  ]);

  const missing = useMemo(
    () =>
      new Set(
        data?.evaluation
          ?.missingProofTypes ?? []
      ),
    [data]
  );

  if (loading) {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
          <LoaderCircle
            size={17}
            className="animate-spin"
          />
          Vérification des exigences KLYX...
        </div>
      </section>
    );
  }

  if (
    error ||
    !data?.rule ||
    !data.evaluation
  ) {
    return (
      <section className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
        <div className="flex gap-3">
          <CircleAlert
            size={18}
            className="mt-0.5 shrink-0 text-rose-500"
          />
          <div>
            <p className="text-sm font-black">
              Exigences indisponibles
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ||
                "Impossible de déterminer les exigences de ce métier."}
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
            <p className="font-black">
              Exigences KLYX
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {evaluation.ready
                ? "Ton dossier remplit les exigences actuelles."
                : "Complète les éléments manquants avant l’envoi."}
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
          {evaluation.ready
            ? "Prêt à envoyer"
            : "Dossier incomplet"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <RequirementRow
          label="Identité"
          detail={
            rule.identityRequired
              ? "Vérification d’identité requise"
              : "Non requise"
          }
          ok={
            !rule.identityRequired ||
            evaluation.identityOk
          }
        />

        <RequirementRow
          label="Expérience"
          detail={
            rule.minimumYearsExperience > 0
              ? `${rule.minimumYearsExperience} année(s) minimum`
              : "Aucun minimum configuré"
          }
          ok={evaluation.experienceOk}
        />

        {rule.insuranceRequired && (
          <RequirementRow
            label="Assurance"
            detail="Assurance professionnelle obligatoire"
            ok={!missing.has("insurance")}
          />
        )}

        {rule.officialRegistrationRequired && (
          <RequirementRow
            label="Autorisation"
            detail={
              rule.officialRegistrationLabel ||
              "Licence ou autorisation professionnelle"
            }
            ok={
              !missing.has(
                "professional_license"
              )
            }
          />
        )}
      </div>

      {rule.requiredProofTypes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Preuves obligatoires
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {rule.requiredProofTypes.map(
              (proof) => {
                const isMissing =
                  missing.has(proof);

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
                    {proofLabel(proof)}
                    {" · "}
                    {isMissing
                      ? "Manquant"
                      : "Validé"}
                  </span>
                );
              }
            )}
          </div>
        </div>
      )}

      {rule.acceptedProofTypes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Preuves acceptées
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {rule.acceptedProofTypes
              .map(proofLabel)
              .join(" · ")}
          </p>
        </div>
      )}

      {rule.ruleLevel === "regulated" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
          <ShieldCheck
            size={18}
            className="mt-0.5 shrink-0 text-violet-600"
          />
          <div>
            <p className="text-sm font-black">
              Activité à exigences renforcées
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              La publication reste bloquée
              jusqu’à validation des justificatifs
              configurés pour ce métier.
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
        <p className="text-sm font-black">
          {label}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {detail}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LegalPath =
  | "unknown"
  | "occasional_compatible"
  | "employment_via_structure"
  | "professional_independent";
type ActivityFrequency = "unknown" | "one_off" | "intermittent" | "recurring";

type Requirement = {
  kind: string;
  key: string;
  status: "satisfied" | "missing" | "pending" | "rejected" | "blocked";
  reasonCode: string;
  humanReviewRequired: boolean;
};

type Restriction = {
  id: string;
  action: string;
  reasonCode: string;
  explanation: string;
  reviewStatus: string;
};

type AuthorityResponse = {
  authority?: {
    decision: "eligible" | "conditional" | "manual_review" | "blocked";
    categoryKey: string;
    requirements: Requirement[];
    reasons: string[];
    humanReviewRequired: boolean;
    reversible: true;
    legalClassificationAutomatic: false;
    facts: {
      declaredLegalPath: LegalPath;
      activityFrequency: ActivityFrequency;
      identityLevel: string;
      trustLevel: string;
      restrictions: Restriction[];
    };
  };
  error?: string;
};

const categories = [
  { value: "babysitting", label: "Babysitting" },
  { value: "cleaning", label: "Ménage" },
  { value: "moving", label: "Déménagement" },
  { value: "handyman", label: "Bricolage" },
];

const legalPaths: Array<{ value: LegalPath; title: string; detail: string }> = [
  {
    value: "occasional_compatible",
    title: "Occasionnel compatible",
    detail:
      "Pour une activité ponctuelle ou intermittente. KLYX vérifie les faits avant de considérer ce parcours compatible.",
  },
  {
    value: "employment_via_structure",
    title: "Relation salariée via structure adaptée",
    detail:
      "Pour une mission exécutée dans un cadre salarié vérifié, par exemple via une structure autorisée lorsqu’elle est requise.",
  },
  {
    value: "professional_independent",
    title: "Professionnel indépendant",
    detail:
      "Pour une activité professionnelle indépendante avec les vérifications nécessaires. La déclaration seule ne suffit pas.",
  },
];

function decisionLabel(value: AuthorityResponse["authority"] extends infer A
  ? A extends { decision: infer D }
    ? D
    : never
  : never) {
  if (value === "eligible") return "Prêt pour cette catégorie";
  if (value === "conditional") return "Éléments encore nécessaires";
  if (value === "manual_review") return "Revue humaine nécessaire";
  return "Accès actuellement restreint";
}

function requirementLabel(requirement: Requirement) {
  if (requirement.kind === "identity") return "Identité";
  if (requirement.kind === "qualification") return `Qualification · ${requirement.key}`;
  if (requirement.kind === "verification") return `Vérification · ${requirement.key}`;
  if (requirement.kind === "trust") return "Niveau de confiance";
  if (requirement.kind === "legal_path") return "Cadre de prestation";
  if (requirement.kind === "category_restriction") return "Restriction de catégorie";
  return "Revue humaine";
}

function statusLabel(status: Requirement["status"]) {
  if (status === "satisfied") return "Validé";
  if (status === "missing") return "Manquant";
  if (status === "pending") return "À vérifier";
  if (status === "rejected") return "À revoir";
  return "Bloqué";
}

export default function TrustSafetyPage() {
  const [category, setCategory] = useState("babysitting");
  const [authority, setAuthority] = useState<AuthorityResponse["authority"] | null>(null);
  const [legalPath, setLegalPath] = useState<LegalPath>("unknown");
  const [frequency, setFrequency] = useState<ActivityFrequency>("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewingRestrictionId, setReviewingRestrictionId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const loadAuthority = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/trust-safety/authority?category=${encodeURIComponent(category)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as AuthorityResponse;
      if (!response.ok || !payload.authority) {
        throw new Error(payload.error || "Impossible de charger les exigences.");
      }
      setAuthority(payload.authority);
      setLegalPath(payload.authority.facts.declaredLegalPath);
      setFrequency(payload.authority.facts.activityFrequency);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les exigences.");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadAuthority();
  }, [loadAuthority]);

  const outstanding = useMemo(
    () => authority?.requirements.filter((item) => item.status !== "satisfied") ?? [],
    [authority]
  );

  async function saveDeclarations() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/trust-safety/authority", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalPath, activityFrequency: frequency, category }),
      });
      const payload = (await response.json()) as AuthorityResponse;
      if (!response.ok || !payload.authority) {
        throw new Error(payload.error || "Impossible d’enregistrer le parcours.");
      }
      setAuthority(payload.authority);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer le parcours.");
    } finally {
      setSaving(false);
    }
  }

  async function requestRestrictionReview(restrictionId: string) {
    if (reviewNote.trim().length < 20) {
      setError("Explique ta demande de revue avec au moins 20 caractères.");
      return;
    }
    setError("");
    const response = await fetch("/api/trust-safety/review-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restrictionId, note: reviewNote.trim() }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Impossible de demander la revue.");
      return;
    }
    setReviewingRestrictionId(null);
    setReviewNote("");
    await loadAuthority();
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16">
        <header className="space-y-4">
          <p className="text-sm font-medium text-blue-500">Trust & Safety</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ce qu’il faut avant de réaliser une mission
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-400">
            KLYX vérifie l’identité, les qualifications éventuelles, le niveau de confiance,
            les restrictions de catégorie et le cadre de prestation applicable. Ce parcours
            n’attribue jamais automatiquement un statut juridique.
          </p>
        </header>

        <section className="space-y-3">
          <label className="text-sm text-zinc-400" htmlFor="category">
            Catégorie de mission
          </label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </section>

        {loading ? (
          <p className="text-zinc-400">Vérification des exigences KLYX…</p>
        ) : authority ? (
          <>
            <section className="space-y-3 border-y border-zinc-900 py-7">
              <p className="text-sm text-zinc-500">Décision actuelle</p>
              <h2 className="text-2xl font-medium">{decisionLabel(authority.decision)}</h2>
              <p className="text-sm leading-6 text-zinc-400">
                {authority.decision === "blocked"
                  ? "Une restriction explicite s’applique. Elle reste motivée, traçable et révisable."
                  : authority.humanReviewRequired
                    ? "KLYX doit faire vérifier certains éléments par une personne avant de conclure."
                    : "Les exigences actuellement connues sont satisfaites pour cette catégorie."}
              </p>
            </section>

            <section className="space-y-5">
              <div>
                <h2 className="text-xl font-medium">Cadre de prestation envisagé</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Choisis le parcours qui décrit le mieux la situation envisagée. KLYX vérifiera
                  sa compatibilité ; ce choix n’est pas une qualification juridique définitive.
                </p>
              </div>

              <div className="space-y-3">
                {legalPaths.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setLegalPath(item.value)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      legalPath === item.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-zinc-500">{item.detail}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400" htmlFor="frequency">
                  Fréquence prévue
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as ActivityFrequency)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="unknown">Je ne sais pas encore</option>
                  <option value="one_off">Une fois</option>
                  <option value="intermittent">De temps en temps</option>
                  <option value="recurring">Régulièrement</option>
                </select>
              </div>

              <button
                type="button"
                disabled={saving || legalPath === "unknown"}
                onClick={() => void saveDeclarations()}
                className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Enregistrement…" : "Vérifier ce parcours"}
              </button>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-medium">Exigences</h2>
              {authority.requirements.map((requirement, index) => (
                <div
                  key={`${requirement.kind}-${requirement.key}-${index}`}
                  className="flex items-start justify-between gap-4 border-b border-zinc-900 py-4"
                >
                  <div>
                    <p className="font-medium">{requirementLabel(requirement)}</p>
                    {requirement.humanReviewRequired ? (
                      <p className="mt-1 text-sm text-zinc-500">Décision humaine requise ou disponible.</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-sm ${
                      requirement.status === "satisfied"
                        ? "text-zinc-300"
                        : requirement.status === "blocked" || requirement.status === "rejected"
                          ? "text-red-400"
                          : "text-blue-400"
                    }`}
                  >
                    {statusLabel(requirement.status)}
                  </span>
                </div>
              ))}
              {outstanding.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucun élément supplémentaire actuellement demandé.</p>
              ) : null}
            </section>

            {authority.facts.restrictions.length > 0 ? (
              <section className="space-y-4 border-t border-zinc-900 pt-7">
                <h2 className="text-xl font-medium">Décisions révisables</h2>
                {authority.facts.restrictions.map((restriction) => (
                  <div key={restriction.id} className="space-y-3 rounded-2xl border border-zinc-800 p-4">
                    <p className="font-medium">{restriction.explanation}</p>
                    <p className="text-xs text-zinc-500">Motif : {restriction.reasonCode}</p>
                    {restriction.reviewStatus === "pending" ? (
                      <p className="text-sm text-blue-400">Revue humaine demandée.</p>
                    ) : reviewingRestrictionId === restriction.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={reviewNote}
                          onChange={(event) => setReviewNote(event.target.value)}
                          rows={4}
                          placeholder="Explique pourquoi cette décision doit être revue…"
                          className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => void requestRestrictionReview(restriction.id)}
                          className="rounded-full border border-zinc-700 px-4 py-2 text-sm"
                        >
                          Envoyer la demande de revue
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReviewingRestrictionId(restriction.id)}
                        className="text-sm font-medium text-blue-400"
                      >
                        Demander une revue humaine
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

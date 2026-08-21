"use client";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AgentStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "ready" | "completed";
  actionHref: string | null;
  requiresConfirmation: boolean;
};

type AgentProviderSnapshot = {
  profileId: string;
  userServiceId: string;
  serviceSlug: string;
  serviceLabel: string;
  firstName: string;
  businessName: string;
  title: string;
  pricingType: "hourly" | "fixed";
  price: number | null;
  city: string;
  klyxScore: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isExactMatch: boolean;
  availabilitySummary: string;
};

type AgentPlan = {
  id: string;
  title: string;
  raw_request?: string;
  service_slug?: string | null;
  city?: string | null;
  requested_day?: string | null;
  requested_time?: string | null;
  duration_hours?: number | null;
  budget_max?: number | null;
  plan_status: string;
  steps: AgentStep[];
  memory_used?: boolean;
  created_at?: string;
  selected_provider_id?: string | null;
  selected_user_service_id?: string | null;
  search_snapshot?: AgentProviderSnapshot[];
  execution_status?: string;
  execution_revision?: number;
  next_action?: string | null;
  next_action_href?: string | null;
  last_execution_code?: string | null;
  last_execution_at?: string | null;
  searchHref?: string | null;
  missingFields?: string[];
};

const EXAMPLES = [
  "Organise un ménage samedi matin à Bruxelles pour 70 € maximum.",
  "Trouve une baby-sitter demain soir pendant 4 heures.",
  "Comme d’habitude vendredi matin.",
  "Organise le montage d’une armoire mardi après-midi.",
];

export default function AgentPage() {
  const [request, setRequest] = useState("");
  const [currentPlan, setCurrentPlan] = useState<AgentPlan | null>(null);
  const [plans, setPlans] = useState<AgentPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function token(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session manquante.");
    }

    return session.access_token;
  }

  async function loadPlans() {
    setLoadingPlans(true);

    try {
      const accessToken = await token();
      const response = await fetch("/api/agent/plans", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as {
        plans?: AgentPlan[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Chargement impossible.");
      }

      setPlans(body.plans ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les plans."
      );
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  async function createPlan(event?: FormEvent, forcedRequest?: string) {
    event?.preventDefault();
    const value = (forcedRequest ?? request).trim();
    if (value.length < 3 || loading) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    setCurrentPlan(null);

    try {
      const accessToken = await token();
      const response = await fetch("/api/agent/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ request: value }),
      });
      const body = (await response.json()) as {
        plan?: AgentPlan;
        error?: string;
      };

      if (!response.ok || !body.plan) {
        throw new Error(body.error || "Création impossible.");
      }

      setCurrentPlan(body.plan);
      setRequest("");
      await loadPlans();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Création impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  async function processPlan(
    planId: string,
    action: "complete" | "cancel",
    stepId?: string
  ) {
    setBusyId(`${planId}:${stepId ?? action}`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/agent/plans", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ planId, action, stepId }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Action impossible.");
      }

      setSuccessMessage(body.message || "Plan mis à jour.");
      await loadPlans();
      if (currentPlan?.id === planId) setCurrentPlan(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Action impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  async function executePlan(planId: string) {
    setBusyId(`${planId}:execute`);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/agent/plans/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ planId }),
      });
      const body = (await response.json()) as {
        plan?: AgentPlan;
        reused?: boolean;
        requiresConfirmation?: string | null;
        error?: string;
      };

      if (!response.ok || !body.plan) {
        throw new Error(body.error || "KLYX n’a pas pu continuer ce plan.");
      }

      setCurrentPlan(body.plan);
      setSuccessMessage(
        body.requiresConfirmation === "book"
          ? body.reused
            ? "Le meilleur prestataire est déjà sélectionné. Confirme la réservation quand tu es prêt."
            : "KLYX a trouvé et sélectionné le meilleur match exact. La réservation attend ta confirmation."
          : "KLYX a terminé la recherche sans engager de réservation."
      );
      await loadPlans();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "KLYX n’a pas pu continuer ce plan."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#3c1764_52%,#101827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Bot size={15} />
            Agent client uniquement
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            KLYX organise, tu confirmes
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Décris ton objectif. KLYX comprend le besoin, recherche les
            prestataires et peut choisir le meilleur match exact. Il ne réserve
            et ne paie jamais sans ta confirmation.
          </p>
        </section>

        <section className="klyx-card mt-8 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="text-violet-600" />
            <h2 className="text-2xl font-black">Que doit organiser KLYX ?</h2>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={loading}
                onClick={() => void createPlan(undefined, example)}
                className="rounded-2xl border border-border bg-background/70 p-4 text-left text-sm font-black transition hover:border-violet-500 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

          <form onSubmit={(event) => void createPlan(event)} className="mt-5">
            <textarea
              rows={5}
              maxLength={2000}
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              className="klyx-input resize-none"
              placeholder="Ex. Organise un ménage samedi matin à Bruxelles."
            />
            <button
              type="submit"
              disabled={loading || request.trim().length < 3}
              className="klyx-button mt-4 w-full"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <ClipboardList size={19} />
              )}
              Créer mon plan
            </button>
          </form>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {currentPlan && (
          <PlanCard
            plan={currentPlan}
            busyId={busyId}
            onProcess={processPlan}
            onExecute={executePlan}
          />
        )}

        <section className="mt-8">
          <p className="klyx-eyebrow">Mes organisations</p>
          <h2 className="mt-2 text-2xl font-black">Plans récents</h2>

          {loadingPlans ? (
            <div className="mt-5 grid min-h-40 place-items-center">
              <LoaderCircle className="animate-spin text-violet-600" size={34} />
            </div>
          ) : plans.length === 0 ? (
            <div className="klyx-card mt-5 p-8 text-center">
              <Bot className="mx-auto text-violet-600" size={40} />
              <p className="mt-4 font-black">Aucun plan créé</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  busyId={busyId}
                  onProcess={processPlan}
                  onExecute={executePlan}
                  compact
                />
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <ShieldCheck
            className="mt-0.5 shrink-0 text-emerald-600"
            size={21}
          />
          <p className="text-sm leading-6 text-muted-foreground">
            KLYX peut exécuter automatiquement les actions réversibles de
            recherche et de recommandation. Choisir un résultat approximatif,
            réserver, annuler une mission ou payer exige toujours ton action
            explicite.
          </p>
        </div>
      </div>
    </main>
  );
}

function PlanCard({
  plan,
  busyId,
  onProcess,
  onExecute,
  compact = false,
}: {
  plan: AgentPlan;
  busyId: string;
  onProcess: (
    planId: string,
    action: "complete" | "cancel",
    stepId?: string
  ) => Promise<void>;
  onExecute: (planId: string) => Promise<void>;
  compact?: boolean;
}) {
  const snapshot = Array.isArray(plan.search_snapshot) ? plan.search_snapshot : [];
  const selected =
    snapshot.find((provider) => provider.profileId === plan.selected_provider_id) ??
    null;
  const executeBusy = busyId === `${plan.id}:execute`;

  return (
    <article className="klyx-card mt-6 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <p className="klyx-eyebrow">{plan.plan_status}</p>
            {plan.execution_status && plan.execution_status !== "idle" && (
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">
                {plan.execution_status}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-black">{plan.title}</h2>
          {plan.raw_request && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {plan.raw_request}
            </p>
          )}
          {plan.memory_used && (
            <p className="mt-3 inline-flex rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-700 dark:text-cyan-300">
              Mémoire client utilisée
            </p>
          )}
        </div>

        {!['completed', 'cancelled'].includes(plan.plan_status) && (
          <button
            type="button"
            disabled={busyId === `${plan.id}:cancel`}
            onClick={() => void onProcess(plan.id, "cancel")}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-500/25 px-3 text-xs font-black text-rose-600 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Annuler le plan
          </button>
        )}
      </div>

      {selected && (
        <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
            Match exact choisi par KLYX
          </p>
          <p className="mt-2 text-lg font-black">
            {selected.businessName || selected.firstName || "Prestataire KLYX"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.title} · {selected.city} · score KLYX {selected.klyxScore}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.availabilitySummary}
          </p>
        </div>
      )}

      {plan.next_action === "search" && !['completed', 'cancelled'].includes(plan.plan_status) && (
        <button
          type="button"
          disabled={executeBusy}
          onClick={() => void onExecute(plan.id)}
          className="klyx-button mt-5"
        >
          {executeBusy ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Search size={18} />
          )}
          KLYX cherche et choisit
        </button>
      )}

      {plan.next_action === "choose" && plan.next_action_href && (
        <Link
          href={plan.next_action_href}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-violet-500/25 px-4 py-2 text-sm font-black text-violet-600"
        >
          <Search size={17} />
          Comparer les alternatives
        </Link>
      )}

      {plan.next_action === "book" && plan.next_action_href && (
        <Link href={plan.next_action_href} className="klyx-button mt-5 inline-flex">
          <ArrowRight size={18} />
          Confirmer la réservation
        </Link>
      )}

      <div className="mt-6 grid gap-3">
        {(plan.steps ?? []).map((step) => {
          const completed = step.status === "completed";
          const ready = step.status === "ready";

          return (
            <div
              key={step.id}
              className="rounded-2xl border border-border bg-background/65 p-4"
            >
              <div className="flex items-start gap-3">
                {completed ? (
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-500"
                    size={20}
                  />
                ) : ready ? (
                  <Check
                    className="mt-0.5 shrink-0 text-violet-600"
                    size={20}
                  />
                ) : (
                  <Circle
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    size={20}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-black">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>

                  {ready && step.actionHref && (
                    <Link
                      href={step.actionHref}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400"
                    >
                      <ArrowRight size={16} />
                      Continuer cette étape
                    </Link>
                  )}

                  {ready && step.id === "complete" && !step.actionHref && (
                    <button
                      type="button"
                      disabled={busyId === `${plan.id}:${step.id}`}
                      onClick={() => void onProcess(plan.id, "complete", step.id)}
                      className="mt-3 text-xs font-black text-emerald-600 disabled:opacity-50"
                    >
                      Valider les informations
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!compact && plan.missingFields?.length ? (
        <p className="mt-5 text-sm text-amber-700 dark:text-amber-300">
          Informations manquantes : {plan.missingFields.join(", ")}.
        </p>
      ) : null}
    </article>
  );
}

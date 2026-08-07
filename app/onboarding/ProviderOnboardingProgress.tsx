"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDashed,
  CreditCard,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProgressState = "loading" | "todo" | "progress" | "done";

type ProviderZone = {
  id: string;
  is_active: boolean;
};

type ProviderService = {
  id: string;
};

type Verification = {
  status: string | null;
};

type VerificationDocument = {
  id: string;
};

type StripeState = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

type Step = {
  id: string;
  title: string;
  description: string;
  href: string;
  button: string;
  icon: typeof Wrench;
  state: ProgressState;
  stateLabel: string;
};

async function bearerToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function ProviderOnboardingProgress() {
  const [services, setServices] = useState<ProviderService[]>([]);
  const [zones, setZones] = useState<ProviderZone[]>([]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [stripe, setStripe] = useState<StripeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");

    try {
      const token = await bearerToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [zonesResponse, verificationResponse, stripeResponse] =
        await Promise.all([
          fetch("/api/provider/zones", { cache: "no-store", headers }),
          fetch("/api/provider/verification", { cache: "no-store", headers }),
          fetch("/api/stripe/connect/status", { cache: "no-store", headers }),
        ]);

      const zonesBody = (await zonesResponse.json()) as {
        services?: ProviderService[];
        zones?: ProviderZone[];
        error?: string;
      };

      const verificationBody = (await verificationResponse.json()) as {
        verification?: Verification;
        documents?: VerificationDocument[];
        error?: string;
      };

      const stripeBody = (await stripeResponse.json()) as
        | StripeState
        | { error?: string };

      if (!zonesResponse.ok) {
        throw new Error(
          zonesBody.error || "Impossible de charger les métiers et zones."
        );
      }

      if (!verificationResponse.ok) {
        throw new Error(
          verificationBody.error || "Impossible de charger la vérification."
        );
      }

      setServices(Array.isArray(zonesBody.services) ? zonesBody.services : []);
      setZones(Array.isArray(zonesBody.zones) ? zonesBody.zones : []);
      setVerification(verificationBody.verification ?? null);
      setDocuments(
        Array.isArray(verificationBody.documents)
          ? verificationBody.documents
          : []
      );

      if (stripeResponse.ok && "connected" in stripeBody) {
        setStripe(stripeBody as StripeState);
      } else {
        setStripe(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d’actualiser la progression."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const steps = useMemo<Step[]>(() => {
    const hasService = services.length > 0;
    const hasZone = zones.some((zone) => zone.is_active !== false);

    const verificationStatus = verification?.status ?? "not_started";
    const verificationDone = verificationStatus === "approved";
    const verificationStarted =
      documents.length > 0 ||
      ["incomplete", "submitted", "under_review"].includes(verificationStatus);

    const stripeDone = Boolean(
      stripe?.connected &&
        stripe.onboardingComplete &&
        stripe.chargesEnabled &&
        stripe.payoutsEnabled
    );

    const stripeStarted = Boolean(
      stripe?.connected || stripe?.onboardingComplete
    );

    return [
      {
        id: "service",
        title: "Premier métier",
        description:
          "Au moins un métier actif doit exister pour que les clients sachent ce que tu proposes.",
        href: "/provider/services/new",
        button: hasService ? "Gérer mes métiers" : "Ajouter mon métier",
        icon: Wrench,
        state: loading ? "loading" : hasService ? "done" : "todo",
        stateLabel: loading ? "Vérification" : hasService ? "Terminé" : "À faire",
      },
      {
        id: "zone",
        title: "Zone d’intervention",
        description:
          "Une zone active permet à KLYX de te montrer aux clients réellement couverts.",
        href: "/provider/zones",
        button: hasZone ? "Gérer mes zones" : "Ajouter une zone",
        icon: MapPinned,
        state: loading ? "loading" : hasZone ? "done" : "todo",
        stateLabel: loading ? "Vérification" : hasZone ? "Terminé" : "À faire",
      },
      {
        id: "verification",
        title: "Vérification",
        description: verificationDone
          ? "Ton dossier de vérification est approuvé."
          : verificationStarted
            ? "Ton dossier a commencé. KLYX suit maintenant son état réel."
            : "Commence par transmettre les éléments nécessaires au centre de vérification.",
        href: "/provider/verification",
        button: verificationDone
          ? "Voir ma vérification"
          : verificationStarted
            ? "Suivre mon dossier"
            : "Commencer",
        icon: ShieldCheck,
        state: loading
          ? "loading"
          : verificationDone
            ? "done"
            : verificationStarted
              ? "progress"
              : "todo",
        stateLabel: loading
          ? "Vérification"
          : verificationDone
            ? "Approuvé"
            : verificationStarted
              ? "En cours"
              : "À faire",
      },
      {
        id: "payments",
        title: "Paiements",
        description: stripeDone
          ? "Ton compte Stripe est prêt à recevoir et transférer des paiements."
          : stripeStarted
            ? "Ton compte Stripe existe mais sa configuration n’est pas encore complètement opérationnelle."
            : "Configure Stripe Connect lorsque tu es prêt à recevoir des paiements professionnels.",
        href: "/provider/payments",
        button: stripeDone
          ? "Voir mes paiements"
          : stripeStarted
            ? "Terminer Stripe"
            : "Configurer Stripe",
        icon: CreditCard,
        state: loading
          ? "loading"
          : stripeDone
            ? "done"
            : stripeStarted
              ? "progress"
              : "todo",
        stateLabel: loading
          ? "Vérification"
          : stripeDone
            ? "Opérationnel"
            : stripeStarted
              ? "En cours"
              : "À faire",
      },
    ];
  }, [documents, loading, services, stripe, verification, zones]);

  const completed = steps.filter((step) => step.state === "done").length;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <div className="mt-6">
      <section className="klyx-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              Progression réelle
            </p>
            <h3 className="mt-2 text-2xl font-black">
              {completed}/4 étapes essentielles terminées
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              KLYX lit directement l’état de ton activité.
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-black transition hover:bg-muted disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <RefreshCw size={17} />
            )}
            Actualiser
          </button>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>{percent}% prêt</span>
          <span>{completed}/4</span>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            {errorMessage}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;

          const isDone = step.state === "done";
          const isProgress = step.state === "progress";

          return (
            <article
              key={step.id}
              className={`klyx-card flex min-h-64 flex-col p-6 ${
                isDone
                  ? "border-emerald-500/20"
                  : isProgress
                    ? "border-amber-500/20"
                    : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${
                    isDone
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : isProgress
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {step.state === "loading" ? (
                    <LoaderCircle size={21} className="animate-spin" />
                  ) : isDone ? (
                    <Check size={22} />
                  ) : isProgress ? (
                    <CircleDashed size={22} />
                  ) : (
                    <Icon size={22} />
                  )}
                </span>

                <span
                  className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${
                    isDone
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : isProgress
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {step.stateLabel}
                </span>
              </div>

              <h3 className="mt-6 text-lg font-black">{step.title}</h3>

              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>

              <Link
                href={step.href}
                prefetch
                className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400"
              >
                {step.button}
                <ArrowRight size={16} />
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

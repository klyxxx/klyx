"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";

type StripeStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
  error?: string;
};

const EMPTY_STATUS: StripeStatus = {
  connected: false,
  onboardingComplete: false,
  chargesEnabled: false,
  payoutsEnabled: false,
};

export default function ProviderPaymentsPage() {
  const [status, setStatus] = useState<StripeStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadStatus() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/stripe/connect/status", {
        cache: "no-store",
      });
      const result = (await response.json()) as StripeStatus;

      if (!response.ok) {
        throw new Error(result.error || "Impossible de vérifier Stripe.");
      }

      setStatus(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de vérifier Stripe."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function continueVerification() {
    setOpeningStripe(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(
          result.error || "Impossible d’ouvrir la vérification Stripe."
        );
      }

      window.location.assign(result.url);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d’ouvrir Stripe."
      );
      setOpeningStripe(false);
    }
  }

  const fullyReady =
    status.connected &&
    status.onboardingComplete &&
    status.chargesEnabled &&
    status.payoutsEnabled;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/provider"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft size={17} />
          Espace prestataire
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]">
            <WalletCards size={15} />
            Paiements prestataire
          </div>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Configuration Stripe
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
            Stripe vérifie ton identité et sécurise les paiements. KLYX affiche
            uniquement le statut nécessaire.
          </p>
        </section>

        {errorMessage && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle size={19} />
            {errorMessage}
          </div>
        )}

        {loading ? (
          <section className="klyx-card mt-8 grid min-h-56 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" size={38} />
          </section>
        ) : (
          <>
            <section
              className={`mt-8 rounded-3xl border p-6 ${
                fullyReady
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-amber-500/25 bg-amber-500/10"
              }`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${
                      fullyReady ? "bg-emerald-600" : "bg-amber-500"
                    }`}
                  >
                    {fullyReady ? <BadgeCheck /> : <Clock3 />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black">
                      {fullyReady
                        ? "Compte prêt à recevoir des paiements"
                        : status.connected
                          ? "Vérification Stripe à terminer"
                          : "Compte Stripe à configurer"}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {fullyReady
                        ? "Paiements et virements activés."
                        : "Ouvre Stripe pour corriger ou compléter les informations."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void continueVerification()}
                  disabled={openingStripe}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {openingStripe ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <ExternalLink size={18} />
                  )}
                  {status.connected
                    ? "Continuer la vérification"
                    : "Configurer les paiements"}
                </button>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <StatusCard
                icon={<ShieldCheck size={20} />}
                title="Compte Stripe"
                ready={status.connected}
                readyText="Connecté"
                waitingText="Non configuré"
              />
              <StatusCard
                icon={<BadgeCheck size={20} />}
                title="Identité et informations"
                ready={status.onboardingComplete}
                readyText="Informations envoyées"
                waitingText="À compléter ou en examen"
              />
              <StatusCard
                icon={<Banknote size={20} />}
                title="Paiements"
                ready={status.chargesEnabled}
                readyText="Activés"
                waitingText="Non activés"
              />
              <StatusCard
                icon={<WalletCards size={20} />}
                title="Virements"
                ready={status.payoutsEnabled}
                readyText="Activés"
                waitingText="Non activés"
              />
            </section>

            <section className="klyx-card mt-6 p-6">
              <h2 className="text-xl font-black">Qui vérifie ?</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Stripe effectue la vérification. Une image incorrecte doit être
                remplacée dans le parcours Stripe avec le bouton ci-dessus.
              </p>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold"
              >
                <RefreshCw size={17} />
                Actualiser le statut
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  icon,
  title,
  ready,
  readyText,
  waitingText,
}: {
  icon: React.ReactNode;
  title: string;
  ready: boolean;
  readyText: string;
  waitingText: string;
}) {
  return (
    <article className="klyx-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
            {icon}
          </span>
          <div>
            <p className="font-black">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ready ? readyText : waitingText}
            </p>
          </div>
        </div>
        {ready ? (
          <CheckCircle2 className="text-emerald-500" />
        ) : (
          <XCircle className="text-amber-500" />
        )}
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ConnectStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
  error?: string;
};

export default function ConnectPage() {
  const router = useRouter();

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }, [router]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch("/api/stripe/connect/status", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result = (await response.json()) as ConnectStatus;

      if (!response.ok) {
        throw new Error(result.error || "Vérification impossible.");
      }

      setStatus(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de vérifier Stripe Connect."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function startOnboarding() {
    setStarting(true);
    setErrorMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Onboarding impossible.");
      }

      window.location.href = result.url;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer Stripe Connect."
      );
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background dark:bg-zinc-950 text-foreground dark:text-white">
        Chargement...
      </main>
    );
  }

  const ready =
    status?.onboardingComplete &&
    status?.chargesEnabled &&
    status?.payoutsEnabled;

  return (
    <main className="min-h-screen bg-background dark:bg-zinc-950 px-4 py-10 text-foreground dark:text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm text-muted-foreground dark:text-zinc-400">
          Retour au tableau de bord
        </Link>

        <section className="mt-8 rounded-3xl border border-border dark:border-zinc-800 bg-card/70 dark:bg-zinc-900/70 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-400">
            KLYX PRESTATAIRE
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Recevoir mes paiements
          </h1>

          <p className="mt-3 text-muted-foreground dark:text-zinc-400">
            Stripe vérifie ton identité et tes coordonnées bancaires. KLYX
            pourra ensuite te reverser automatiquement ta part.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 space-y-3">
            <StatusLine
              label="Compte Stripe créé"
              complete={Boolean(status?.connected)}
            />
            <StatusLine
              label="Informations transmises"
              complete={Boolean(status?.onboardingComplete)}
            />
            <StatusLine
              label="Paiements activés"
              complete={Boolean(status?.chargesEnabled)}
            />
            <StatusLine
              label="Versements bancaires activés"
              complete={Boolean(status?.payoutsEnabled)}
            />
          </div>

          {ready ? (
            <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-300">
              Ton compte Stripe est prêt à recevoir les paiements KLYX.
            </div>
          ) : (
            <button
              type="button"
              onClick={startOnboarding}
              disabled={starting}
              className="mt-8 w-full rounded-xl bg-violet-600 px-6 py-4 text-lg font-semibold hover:bg-violet-700 disabled:opacity-60"
            >
              {starting
                ? "Redirection vers Stripe..."
                : status?.connected
                  ? "Continuer la configuration Stripe"
                  : "Configurer mes versements"}
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadStatus()}
            className="mt-4 w-full rounded-xl border border-border dark:border-zinc-700 px-6 py-3 font-semibold hover:bg-muted dark:bg-zinc-800"
          >
            Actualiser le statut
          </button>
        </section>
      </div>
    </main>
  );
}

function StatusLine({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border dark:border-zinc-800 bg-background dark:bg-zinc-950 px-4 py-3">
      <span>{label}</span>
      <span className={complete ? "text-emerald-400" : "text-amber-400"}>
        {complete ? "Terminé" : "À compléter"}
      </span>
    </div>
  );
}
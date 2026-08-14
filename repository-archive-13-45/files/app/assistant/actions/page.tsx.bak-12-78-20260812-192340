"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Star,
  TimerReset,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActionItem = {
  id: string;
  kind:
    | "compare_offers"
    | "finalize_booking"
    | "payment_pending"
    | "review_completed"
    | "provider_offer_update";
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type ActionsResponse = {
  profileId: string;
  accountType: "client" | "provider";
  actions: ActionItem[];
  count: number;
};

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

function ActionIcon({
  kind,
}: {
  kind: ActionItem["kind"];
}) {
  if (kind === "payment_pending") {
    return <CreditCard size={20} />;
  }

  if (kind === "review_completed") {
    return <Star size={20} />;
  }

  if (kind === "finalize_booking") {
    return <TimerReset size={20} />;
  }

  if (kind === "provider_offer_update") {
    return <CheckCircle2 size={20} />;
  }

  return <Sparkles size={20} />;
}

export default function AssistantActionsPage() {
  const [data, setData] =
    useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();

      const response = await fetch("/api/brain/actions", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = (await response.json()) as
        | ActionsResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in body
            ? body.error || "Actions indisponibles."
            : "Actions indisponibles."
        );
      }

      setData(body as ActionsResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Actions indisponibles."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={14} />
            KLYX Action Center
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            Ce qui mérite ton attention maintenant
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX rassemble les prochaines actions utiles de ton profil actif
            et les classe par priorité.
          </p>
        </section>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              {data?.count ?? 0} action
              {(data?.count ?? 0) > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Profil {data?.accountType === "provider" ? "prestataire" : "client"}
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            Actualiser
          </button>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" size={36} />
          </div>
        ) : !data || data.actions.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black">
              Rien d’urgent
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              KLYX ne détecte aucune action prioritaire pour le moment.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4">
            {data.actions.map((action, index) => (
              <article
                key={action.id}
                className="klyx-card grid gap-5 p-5 sm:grid-cols-[52px_1fr_auto] sm:items-center sm:p-6"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <ActionIcon kind={action.kind} />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Priorité {index + 1}
                    </span>

                    {action.priority >= 95 && (
                      <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-rose-700 dark:text-rose-300">
                        Important
                      </span>
                    )}
                  </div>

                  <h2 className="mt-2 text-lg font-black">
                    {action.title}
                  </h2>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>
                </div>

                <Link
                  href={action.href}
                  className="klyx-button"
                >
                  {action.label}
                  <ArrowRight size={17} />
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

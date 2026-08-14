"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ListTodo,
  LoaderCircle,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProactiveAssistantPanel from "@/app/components/ProactiveAssistantPanel";
import AssistantBrief from "@/app/components/AssistantBrief";
import AssistantCommandBar from "@/app/components/AssistantCommandBar";

type AccountType = "client" | "provider";

type ActionItem = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type ActionsResponse = {
  accountType: AccountType;
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

export default function AssistantHomePage() {
  const [data, setData] =
    useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const accessToken = await token();

        const response = await fetch(
          "/api/brain/actions",
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

        const body = (await response.json()) as
          | ActionsResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in body
              ? body.error ||
                  "Impossible de charger KLYX."
              : "Impossible de charger KLYX."
          );
        }

        if (active) {
          setData(body as ActionsResponse);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger KLYX."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const accountType =
    data?.accountType ?? "client";

  const topAction =
    data?.actions?.[0] ?? null;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#4c1d95_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={14} />
            KLYX Assistant
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            Dis-moi ce qu’il faut faire.
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            KLYX rassemble tes prochaines actions,
            tes demandes et les outils utiles de ton
            profil actif au même endroit.
          </p>

          <AssistantBrief />

          {/* KLYX_SMART_COMMAND_HOME_12_79 */}
          <AssistantCommandBar
            actions={data?.actions ?? []}
          />
        </section>

        <ProactiveAssistantPanel />

        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-56 place-items-center">
            <LoaderCircle
              className="animate-spin text-violet-600"
              size={34}
            />
          </div>
        ) : (
          <>
            {topAction ? (
              <section className="klyx-card mt-6 border-violet-500/25 p-6 sm:p-8">
                <p className="klyx-eyebrow">
                  Priorité KLYX
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {topAction.title}
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {topAction.description}
                </p>

                <Link
                  href={topAction.href}
                  className="klyx-button mt-5"
                >
                  {topAction.label}
                  <ArrowRight size={17} />
                </Link>
              </section>
            ) : (
              <section className="klyx-card mt-6 border-emerald-500/20 p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 size={21} />
                  </div>

                  <div>
                    <p className="klyx-eyebrow">
                      Tout est à jour
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      Aucune action prioritaire
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tu peux lancer une nouvelle action quand tu veux.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accountType === "client" ? (
                <>
                  <Card
                    href="/assistant/market"
                    icon={<MessageSquareText size={21} />}
                    title="Décrire un besoin"
                    text="Parle normalement à KLYX. Il prépare la demande, puis tu confirmes."
                  />

                  <Card
                    href="/assistant/actions"
                    icon={<ListTodo size={21} />}
                    title="Mes actions"
                    text={`${data?.count ?? 0} action${
                      (data?.count ?? 0) > 1 ? "s" : ""
                    } détectée${
                      (data?.count ?? 0) > 1 ? "s" : ""
                    } par KLYX.`}
                  />

                  <Card
                    href="/requests"
                    icon={<BriefcaseBusiness size={21} />}
                    title="Mes demandes"
                    text="Suis les offres reçues, compare et choisis ton prestataire."
                  />

                  <Card
                    href="/search"
                    icon={<Search size={21} />}
                    title="Trouver directement"
                    text="Recherche un prestataire et réserve sans publier de demande ouverte."
                  />

                  <Card
                    href="/brain"
                    icon={<Bot size={21} />}
                    title="Assistant général"
                    text="Retrouve le Brain KLYX et ses recommandations générales."
                  />
                </>
              ) : (
                <>
                  <Card
                    href="/assistant/actions"
                    icon={<ListTodo size={21} />}
                    title="Mes actions"
                    text={`${data?.count ?? 0} action${
                      (data?.count ?? 0) > 1 ? "s" : ""
                    } prioritaire${
                      (data?.count ?? 0) > 1 ? "s" : ""
                    } pour ton activité.`}
                  />

                  <Card
                    href="/provider/jobs"
                    icon={<BriefcaseBusiness size={21} />}
                    title="Missions disponibles"
                    text="Découvre les demandes compatibles classées par KLYX."
                  />

                  <Card
                    href="/provider/assistant"
                    icon={<Bot size={21} />}
                    title="Assistant professionnel"
                    text="Pilote ton activité, ton planning et tes prochaines décisions."
                  />
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="klyx-card group p-6 transition hover:-translate-y-0.5 hover:border-violet-500/25"
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-600">
        {icon}
      </div>

      <h2 className="mt-5 text-lg font-black">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {text}
      </p>

      <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-600">
        Ouvrir
        <ArrowRight
          size={16}
          className="transition group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}

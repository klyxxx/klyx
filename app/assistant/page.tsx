"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Camera,
  ListTodo,
  LoaderCircle,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import AssistantCommandBar from "@/app/components/AssistantCommandBar";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAssistantHomeActionCount,
  translateKlyxAssistantHome,
  type KlyxAssistantHomeMessageKey,
} from "@/lib/klyx-assistant-home-i18n";
import { supabase } from "@/lib/supabase";

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

  if (!session?.access_token) throw new Error("Session manquante.");
  return session.access_token;
}

export default function AssistantHomePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantHomeMessageKey) =>
    translateKlyxAssistantHome(locale, key);

  const [data, setData] = useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const accessToken = await token();
        const response = await fetch("/api/brain/actions", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) throw new Error("Assistant actions unavailable");

        const body = (await response.json()) as ActionsResponse;
        if (active) {
          setData(body);
          setErrorMessage("");
        }
      } catch {
        if (active) setErrorMessage(t("loadError"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [locale]);

  const accountType = data?.accountType ?? "client";
  const topAction = data?.actions?.[0] ?? null;

  return (
    <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mx-auto max-w-2xl pt-5 text-center sm:pt-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300">
            <Sparkles size={23} />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
            Que puis-je faire pour toi ?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Décris ton besoin normalement. KLYX comprend la demande, retrouve l’action utile et te laisse confirmer avant toute étape importante.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-3xl sm:mt-10">
          <AssistantCommandBar actions={data?.actions ?? []} />
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-3xl text-center text-xs font-semibold text-rose-600 dark:text-rose-300"
          >
            {errorMessage}
          </p>
        )}

        {loading ? (
          <div className="grid min-h-32 place-items-center" aria-live="polite">
            <LoaderCircle className="animate-spin text-violet-500" size={24} />
            <span className="sr-only">Chargement de KLYX</span>
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-3xl">
            {topAction && (
              <Link
                href={topAction.href}
                className="group flex items-center gap-4 rounded-2xl border border-violet-500/15 bg-violet-500/[0.045] p-4 transition hover:bg-violet-500/[0.075]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300">
                  <Sparkles size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
                    {t("priority")}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold">
                    {topAction.title}
                  </span>
                  <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
                    {topAction.description}
                  </span>
                </span>
                <ArrowRight
                  size={17}
                  className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground"
                />
              </Link>
            )}

            <p className="mb-3 mt-7 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Raccourcis
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {accountType === "client" ? (
                <>
                  <QuickLink
                    href="/assistant/market"
                    icon={<MessageSquareText size={17} />}
                    title={t("describeNeedTitle")}
                    text={t("describeNeedText")}
                  />
                  <QuickLink
                    href="/request/photo"
                    icon={<Camera size={17} />}
                    title="Montrer une photo"
                    text="Laisser KLYX identifier le métier utile."
                  />
                  <QuickLink
                    href="/assistant/actions"
                    icon={<ListTodo size={17} />}
                    title={t("actionsTitle")}
                    text={formatKlyxAssistantHomeActionCount(
                      locale,
                      data?.count ?? 0,
                      "client"
                    )}
                  />
                  <QuickLink
                    href="/search"
                    icon={<Search size={17} />}
                    title={t("searchTitle")}
                    text={t("searchText")}
                  />
                </>
              ) : (
                <>
                  <QuickLink
                    href="/provider/assistant"
                    icon={<Bot size={17} />}
                    title="Assistant KLYX"
                    text={t("providerAssistantText")}
                  />
                  <QuickLink
                    href="/provider/jobs"
                    icon={<BriefcaseBusiness size={17} />}
                    title={t("providerJobsTitle")}
                    text={t("providerJobsText")}
                  />
                  <QuickLink
                    href="/assistant/actions"
                    icon={<ListTodo size={17} />}
                    title={t("actionsTitle")}
                    text={formatKlyxAssistantHomeActionCount(
                      locale,
                      data?.count ?? 0,
                      "provider"
                    )}
                  />
                </>
              )}
            </div>

            <p className="mt-8 text-center text-[10px] text-muted-foreground">
              KLYX peut préparer et orienter. Les réservations, sélections et paiements restent soumis à ta confirmation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function QuickLink({
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
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card/55 p-4 transition hover:border-violet-500/20 hover:bg-muted/60 dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.045]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-violet-500/10 group-hover:text-violet-600 dark:bg-white/[0.05] dark:group-hover:text-violet-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {text}
        </span>
      </span>
    </Link>
  );
}

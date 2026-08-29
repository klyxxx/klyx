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

import AssistantBrief from "@/app/components/AssistantBrief";
import AssistantCommandBar from "@/app/components/AssistantCommandBar";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import ProactiveAssistantPanel from "@/app/components/ProactiveAssistantPanel";
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

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function AssistantHomePage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantHomeMessageKey) =>
    translateKlyxAssistantHome(locale, key);

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

        if (!response.ok) {
          throw new Error("Assistant actions unavailable");
        }

        const body = (await response.json()) as ActionsResponse;

        if (active) {
          setData(body);
          setErrorMessage("");
        }
      } catch {
        if (active) {
          setErrorMessage(t("loadError"));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [locale]);

  const accountType =
    data?.accountType ?? "client";

  const topAction =
    data?.actions?.[0] ?? null;

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="klyx-premium-hero overflow-hidden rounded-[2rem] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <Sparkles size={14} />
            {t("badge")}
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>

          <AssistantBrief />

          <AssistantCommandBar
            actions={data?.actions ?? []}
          />
        </section>

        <ProactiveAssistantPanel />

        {errorMessage && (
          <div
            role="alert"
            className="klyx-feedback klyx-feedback-error mt-5"
          >
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div
            className="grid min-h-56 place-items-center"
            aria-live="polite"
          >
            <LoaderCircle
              className="animate-spin text-violet-600"
              size={34}
            />
            <span className="sr-only">
              Chargement de KLYX
            </span>
          </div>
        ) : (
          <>
            {topAction ? (
              <section className="klyx-card mt-6 border-violet-500/25 p-6 sm:p-8">
                <p className="klyx-eyebrow">
                  {t("priority")}
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
                      {t("upToDate")}
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {t("noPriority")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("noPriorityDescription")}
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
                    title={t("describeNeedTitle")}
                    text={t("describeNeedText")}
                    openLabel={t("open")}
                  />

                  <Card
                    href="/assistant/actions"
                    icon={<ListTodo size={21} />}
                    title={t("actionsTitle")}
                    text={formatKlyxAssistantHomeActionCount(
                      locale,
                      data?.count ?? 0,
                      "client"
                    )}
                    openLabel={t("open")}
                  />

                  <Card
                    href="/requests"
                    icon={<BriefcaseBusiness size={21} />}
                    title={t("requestsTitle")}
                    text={t("requestsText")}
                    openLabel={t("open")}
                  />

                  <Card
                    href="/search"
                    icon={<Search size={21} />}
                    title={t("searchTitle")}
                    text={t("searchText")}
                    openLabel={t("open")}
                  />
                </>
              ) : (
                <>
                  <Card
                    href="/assistant/actions"
                    icon={<ListTodo size={21} />}
                    title={t("actionsTitle")}
                    text={formatKlyxAssistantHomeActionCount(
                      locale,
                      data?.count ?? 0,
                      "provider"
                    )}
                    openLabel={t("open")}
                  />

                  <Card
                    href="/provider/jobs"
                    icon={<BriefcaseBusiness size={21} />}
                    title={t("providerJobsTitle")}
                    text={t("providerJobsText")}
                    openLabel={t("open")}
                  />

                  <Card
                    href="/provider/assistant"
                    icon={<Bot size={21} />}
                    title={t("providerAssistantTitle")}
                    text={t("providerAssistantText")}
                    openLabel={t("open")}
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
  openLabel,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  openLabel: string;
}) {
  return (
    <Link
      href={href}
      className="klyx-card klyx-premium-interactive group p-6"
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
        {openLabel}
        <ArrowRight
          size={16}
          className="transition group-hover:translate-x-1"
        />
      </span>
    </Link>
  );
}

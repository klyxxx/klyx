"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  explainKlyxProactiveAction,
  translateKlyxProactiveAssistant,
  type KlyxProactiveAssistantMessageKey,
} from "@/lib/klyx-proactive-assistant-i18n";
import { supabase } from "@/lib/supabase";

type ActionKind =
  | "compare_offers"
  | "finalize_booking"
  | "payment_pending"
  | "review_completed"
  | "provider_offer_update"
  | string;

type ActionItem = {
  id: string;
  kind: ActionKind;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type ActionsResponse = {
  accountType: "client" | "provider";
  actions: ActionItem[];
  count: number;
};

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Session manquante.");
  }

  return session.access_token;
}

export default function ProactiveAssistantPanel() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProactiveAssistantMessageKey) =>
    translateKlyxProactiveAssistant(locale, key);

  const [data, setData] = useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await accessToken();

      const response = await fetch("/api/brain/actions", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Priorities unavailable");
      }

      const body = (await response.json()) as ActionsResponse;
      setData(body);
      setHasLoadError(false);
    } catch {
      setHasLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [load, locale]);

  const topActions = useMemo(
    () => (data?.actions ?? []).slice(0, 3),
    [data]
  );

  if (loading) {
    return (
      <section className="klyx-card mt-6 p-6">
        <div className="flex items-center gap-3 text-sm font-black text-muted-foreground">
          <LoaderCircle className="animate-spin" size={18} />
          {t("loading")}
        </div>
      </section>
    );
  }

  if (hasLoadError) {
    return (
      <section className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
        {t("loadError")}
      </section>
    );
  }

  if (topActions.length === 0) {
    return (
      <section className="klyx-card mt-6 border-emerald-500/20 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <p className="klyx-eyebrow">{t("eyebrow")}</p>
            <h2 className="mt-1 text-xl font-black">
              {t("emptyTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="klyx-eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-black">
            {t("title")}
          </h2>
        </div>

        <Link
          href="/assistant/actions"
          className="text-sm font-black text-violet-600 hover:underline"
        >
          {t("viewAll")}
        </Link>
      </div>

      <div className="mt-4 grid gap-4">
        {topActions.map((action, index) => {
          const info = explainKlyxProactiveAction(locale, action.kind);
          const urgent = action.priority >= 95;

          return (
            <article
              key={action.id}
              className={`klyx-card p-6 ${
                urgent
                  ? "border-rose-500/25"
                  : index === 0
                    ? "border-violet-500/25"
                    : ""
              }`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                        urgent
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          : "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      }`}
                    >
                      {urgent ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {t("priority")} {index + 1}
                    </span>

                    <span className="text-xs font-bold text-muted-foreground">
                      {t("score")} {action.priority}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-black">
                    {action.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </p>

                  <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      {t("whyNow")}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {info.why}
                    </p>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck
                      className="mt-0.5 shrink-0 text-blue-600"
                      size={15}
                    />
                    <span>{info.confirmation}</span>
                  </div>
                </div>

                <Link
                  href={action.href}
                  className="klyx-button shrink-0"
                >
                  {action.label}
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

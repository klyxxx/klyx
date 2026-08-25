"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAssistantBriefText,
  formatKlyxAssistantBriefUrgentCount,
  translateKlyxAssistantBrief,
  type KlyxAssistantBriefMessageKey,
} from "@/lib/klyx-assistant-brief-i18n";
import { supabase } from "@/lib/supabase";

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

export default function AssistantBrief() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantBriefMessageKey) =>
    translateKlyxAssistantBrief(locale, key);

  const [data, setData] = useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await accessToken();

      const response = await fetch("/api/brain/actions", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const body = (await response.json()) as ActionsResponse;
      setData(body);
    } catch {
      // The brief must never block the assistant.
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

  const urgentCount = useMemo(
    () =>
      (data?.actions ?? []).filter(
        (action) => action.priority >= 95
      ).length,
    [data]
  );

  if (loading) {
    return (
      <div className="mt-5 flex items-center gap-2 text-sm text-white/60">
        <LoaderCircle className="animate-spin" size={16} />
        {t("loading")}
      </div>
    );
  }

  if (!data) return null;

  const first = data.actions?.[0] ?? null;
  const remaining = Math.max(0, (data.actions?.length ?? 0) - 1);

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-black/15 p-5 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
              <Sparkles size={14} />
              {t("eyebrow")}
            </span>

            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                <BellRing size={11} />
                {formatKlyxAssistantBriefUrgentCount(locale, urgentCount)}
              </span>
            )}

            {!first && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
                <CheckCircle2 size={14} />
                {t("upToDate")}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm font-semibold leading-6 text-white/90">
            {formatKlyxAssistantBriefText(
              locale,
              data.accountType,
              first?.title ?? null,
              remaining
            )}
          </p>
        </div>

        {first ? (
          <Link
            href={first.href}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950 transition hover:bg-white/90"
          >
            {first.label}
            <ArrowRight size={16} />
          </Link>
        ) : (
          <Link
            href={
              data.accountType === "provider"
                ? "/provider/jobs"
                : "/assistant/market"
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/10"
          >
            {data.accountType === "provider"
              ? t("providerFallbackCta")
              : t("clientFallbackCta")}
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Flag,
  LoaderCircle,
  Navigation,
  RefreshCw,
  Sparkles,
  Star,
  TimerReset,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAssistantActionCount,
  translateKlyxAssistantActions,
  type KlyxAssistantActionsMessageKey,
} from "@/lib/klyx-assistant-actions-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_ACTION_CENTER_MISSION_UI_12_78
// KLYX_ASSISTANT_ACTIONS_PAGE_I18N
// KLYX_ASSISTANT_ACTIONS_READ_ONLY

type ActionKind =
  | "compare_offers"
  | "finalize_booking"
  | "payment_pending"
  | "track_mission"
  | "confirm_completion"
  | "review_completed"
  | "provider_offer_update"
  | "provider_booking_request"
  | "provider_track_mission"
  | "provider_finish_mission";

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
    throw new Error("Session missing");
  }

  return session.access_token;
}

function ActionIcon({
  kind,
}: {
  kind: ActionKind;
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

  if (
    kind === "track_mission" ||
    kind === "provider_track_mission"
  ) {
    return <Navigation size={20} />;
  }

  if (kind === "confirm_completion") {
    return <CheckCircle2 size={20} />;
  }

  if (kind === "provider_booking_request") {
    return <CalendarCheck2 size={20} />;
  }

  if (kind === "provider_finish_mission") {
    return <Flag size={20} />;
  }

  if (kind === "provider_offer_update") {
    return <CheckCircle2 size={20} />;
  }

  return <Sparkles size={20} />;
}

export default function AssistantActionsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAssistantActionsMessageKey) =>
    translateKlyxAssistantActions(locale, key);

  const [data, setData] =
    useState<ActionsResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [hasLoadError, setHasLoadError] =
    useState(false);

  const load = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setHasLoadError(false);

      try {
        const accessToken = await token();

        const response = await fetch(
          "/api/brain/actions",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " + accessToken,
            },
          }
        );

        const body =
          (await response.json()) as ActionsResponse;

        if (!response.ok) {
          throw new Error("Actions unavailable");
        }

        setData(body);
      } catch {
        setHasLoadError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(false);
  }, [load, locale]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="klyx-card p-7 sm:p-10">
          <div className="klyx-eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
            <Sparkles size={14} />
            {t("eyebrow")}
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
            {t("description")}
          </p>
        </section>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              {formatKlyxAssistantActionCount(locale, data?.count ?? 0)}
            </p>

            <p className="text-xs text-muted-foreground">
              {data?.accountType === "provider"
                ? t("profileProvider")
                : t("profileClient")}
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? (
              <LoaderCircle
                className="animate-spin"
                size={15}
              />
            ) : (
              <RefreshCw size={15} />
            )}
            {t("refresh")}
          </button>
        </div>

        {hasLoadError && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {t("loadError")}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <div className="flex items-center gap-3 text-sm font-black text-muted-foreground">
              <LoaderCircle
                className="animate-spin text-blue-600"
                size={36}
              />
              {t("loading")}
            </div>
          </div>
        ) : !data ||
          data.actions.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>

            <h2 className="mt-5 text-xl font-black">
              {t("emptyTitle")}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4">
            {data.actions.map(
              (action, index) => (
                <article
                  key={action.id}
                  className="klyx-card grid gap-5 p-5 sm:grid-cols-[52px_1fr_auto] sm:items-center sm:p-6"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
                    <ActionIcon
                      kind={action.kind}
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                        {t("priority")} {index + 1}
                      </span>

                      {action.priority >= 105 && (
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-rose-700 dark:text-rose-300">
                          {t("important")}
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
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}

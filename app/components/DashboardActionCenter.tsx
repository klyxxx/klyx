"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  resolveKlyxDashboardLocale,
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
} from "@/lib/klyx-dashboard-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_GLOBAL_DASHBOARD_ACTION_CENTER_13_81

type AccountType = "client" | "provider";

type Quote = {
  id: string;
  status: string;
};

type BookingOverviewCard = {
  id: string;
  status: string;
  history: boolean;
  actionRequired: boolean;
};

type ActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  count?: number;
  icon:
    | typeof FileText
    | typeof FileCheck2
    | typeof Clock3
    | typeof CalendarDays;
  important?: boolean;
  priority: number;
};

const CONTROL_COPY = {
  fr: "KLYX organise les priorités mais ne confirme aucune action automatiquement.",
  en: "KLYX organizes priorities but never confirms an action automatically.",
  nl: "KLYX ordent prioriteiten maar bevestigt nooit automatisch een actie.",
  de: "KLYX ordnet Prioritäten, bestätigt aber keine Aktion automatisch.",
} as const;

async function accessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("missing-session");
  }

  return session.access_token;
}

export default function DashboardActionCenter({
  accountType,
}: {
  accountType: AccountType;
}) {
  const { locale } = useKlyxLocale();
  const resolvedLocale = resolveKlyxDashboardLocale(locale);
  const t = (key: KlyxDashboardMessageKey) =>
    translateKlyxDashboard(locale, key);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<BookingOverviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadFailed(false);

      try {
        const token = await accessToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [quotesResponse, bookingsResponse] = await Promise.all([
          fetch("/api/quotes", { cache: "no-store", headers }),
          fetch("/api/bookings/overview", { cache: "no-store", headers }),
        ]);

        const quotesBody = (await quotesResponse.json()) as {
          quotes?: Quote[];
        };
        const bookingsBody = (await bookingsResponse.json()) as {
          cards?: BookingOverviewCard[];
        };

        if (!quotesResponse.ok || !bookingsResponse.ok) {
          throw new Error("dashboard-action-load-failed");
        }

        if (cancelled) return;

        setQuotes(Array.isArray(quotesBody.quotes) ? quotesBody.quotes : []);
        setBookings(
          Array.isArray(bookingsBody.cards) ? bookingsBody.cards : []
        );
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accountType]);

  const actions = useMemo<ActionItem[]>(() => {
    const tr = (key: KlyxDashboardMessageKey) =>
      translateKlyxDashboard(locale, key);
    const quoteCount = (status: string) =>
      quotes.filter((quote) => quote.status === status).length;
    const bookingActions = bookings.filter(
      (booking) => booking.actionRequired
    ).length;
    const upcomingBookings = bookings.filter(
      (booking) => !booking.history
    ).length;
    const result: ActionItem[] = [];

    if (bookingActions > 0) {
      result.push({
        id: "booking-actions",
        title: tr(
          accountType === "provider"
            ? "actionBookingProviderTitle"
            : "actionBookingClientTitle"
        ),
        description: tr(
          accountType === "provider"
            ? "actionBookingProviderDescription"
            : "actionBookingClientDescription"
        ),
        href: "/bookings",
        count: bookingActions,
        icon: CalendarDays,
        important: true,
        priority: 100,
      });
    }

    if (accountType === "provider") {
      const requested = quoteCount("requested");
      const sent = quoteCount("sent");

      if (requested > 0) {
        result.push({
          id: "provider-quotes-requested",
          title: tr("actionProviderQuotesRequestedTitle"),
          description: tr("actionProviderQuotesRequestedDescription"),
          href: "/provider/quotes",
          count: requested,
          icon: FileText,
          important: true,
          priority: 90,
        });
      }

      if (sent > 0) {
        result.push({
          id: "provider-quotes-sent",
          title: tr("actionProviderQuotesSentTitle"),
          description: tr("actionProviderQuotesSentDescription"),
          href: "/provider/quotes",
          count: sent,
          icon: Clock3,
          priority: 60,
        });
      }
    }

    if (accountType === "client") {
      const sent = quoteCount("sent");
      const accepted = quoteCount("accepted");
      const requested = quoteCount("requested");

      if (sent > 0) {
        result.push({
          id: "client-quotes-sent",
          title: tr("actionClientQuotesSentTitle"),
          description: tr("actionClientQuotesSentDescription"),
          href: "/quotes",
          count: sent,
          icon: FileCheck2,
          important: true,
          priority: 85,
        });
      }

      if (accepted > 0) {
        result.push({
          id: "client-quotes-accepted",
          title: tr("actionClientQuotesAcceptedTitle"),
          description: tr("actionClientQuotesAcceptedDescription"),
          href: "/quotes",
          count: accepted,
          icon: FileText,
          important: true,
          priority: 80,
        });
      }

      if (requested > 0) {
        result.push({
          id: "client-quotes-requested",
          title: tr("actionClientQuotesRequestedTitle"),
          description: tr("actionClientQuotesRequestedDescription"),
          href: "/quotes",
          count: requested,
          icon: Clock3,
          priority: 50,
        });
      }
    }

    if (upcomingBookings > 0 && bookingActions === 0) {
      result.push({
        id: "upcoming-bookings",
        title: tr(
          accountType === "provider"
            ? "actionUpcomingProviderTitle"
            : "actionUpcomingClientTitle"
        ),
        description: tr(
          accountType === "provider"
            ? "actionUpcomingProviderDescription"
            : "actionUpcomingClientDescription"
        ),
        href: "/bookings",
        count: upcomingBookings,
        icon: CalendarDays,
        priority: 40,
      });
    }

    return result.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [accountType, bookings, locale, quotes]);

  const provider = accountType === "provider";
  const prioritySuffix =
    resolvedLocale === "en"
      ? actions.length === 1
        ? "y"
        : "ies"
      : resolvedLocale === "nl" || resolvedLocale === "de"
        ? actions.length === 1
          ? ""
          : "en"
        : actions.length === 1
          ? ""
          : "s";

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className={
              provider
                ? "text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400"
                : "klyx-eyebrow"
            }
          >
            {t("actionEyebrow")}
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {t(provider ? "actionProviderTitle" : "actionClientTitle")}
          </h2>
        </div>

        {!loading && actions.length > 0 && (
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
            {translateKlyxDashboard(locale, "actionPriorityCount", {
              count: actions.length,
              suffix: prioritySuffix,
            })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="klyx-card mt-5 flex min-h-28 items-center gap-4 p-5">
          <span
            className={
              "grid h-11 w-11 place-items-center rounded-2xl " +
              (provider
                ? "bg-blue-500/10 text-blue-600"
                : "bg-violet-500/10 text-violet-600")
            }
          >
            <LoaderCircle className="animate-spin" size={20} />
          </span>

          <div>
            <p className="font-black">{t("actionLoadingTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("actionLoadingDescription")}
            </p>
          </div>
        </div>
      ) : loadFailed ? (
        <div className="klyx-card mt-5 p-5">
          <p className="text-sm text-muted-foreground">
            {t("actionLoadFailed")}
          </p>
        </div>
      ) : actions.length === 0 ? (
        <div className="klyx-card mt-5 flex items-start gap-4 p-5 sm:p-6">
          <span
            className={
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl " +
              (provider
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-violet-500/10 text-violet-600 dark:text-violet-400")
            }
          >
            <CheckCircle2 size={22} />
          </span>

          <div>
            <h3 className="font-black">{t("actionNothingUrgent")}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(
                provider
                  ? "actionProviderNothingUrgent"
                  : "actionClientNothingUrgent"
              )}
            </p>

            <Link
              href={provider ? "/provider/jobs" : "/assistant/market"}
              className={
                "mt-4 inline-flex items-center gap-2 text-sm font-black " +
                (provider
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-violet-600 dark:text-violet-400")
              }
            >
              {t(provider ? "actionProviderExplore" : "actionClientExplore")}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.id}
                href={action.href}
                prefetch
                className={
                  "klyx-card klyx-card-hover group relative flex min-h-48 flex-col overflow-hidden p-5 sm:p-6 " +
                  (action.important
                    ? provider
                      ? "border-blue-500/30 bg-blue-500/[0.045]"
                      : "border-violet-500/30 bg-violet-500/[0.045]"
                    : "")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={
                      "grid h-11 w-11 place-items-center rounded-2xl " +
                      (provider
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-violet-500/10 text-violet-600 dark:text-violet-400")
                    }
                  >
                    <Icon size={20} />
                  </span>

                  {typeof action.count === "number" && (
                    <span
                      className={
                        "grid min-h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-black " +
                        (provider
                          ? "bg-blue-600 text-white"
                          : "bg-violet-600 text-white")
                      }
                    >
                      {action.count}
                    </span>
                  )}
                </div>

                <h3 className="mt-5 text-lg font-black">{action.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>

                <span
                  className={
                    "mt-5 inline-flex items-center gap-2 text-sm font-black " +
                    (provider
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-violet-600 dark:text-violet-400")
                  }
                >
                  {t("open")}
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles
          size={14}
          className={provider ? "text-blue-500" : "text-violet-500"}
        />
        {/* KLYX_ACTION_CENTER_CONTROL_13_81 */}
        {CONTROL_COPY[resolvedLocale]}
      </div>
    </section>
  );
}

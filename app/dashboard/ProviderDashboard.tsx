"use client";

import Link from "next/link";

import DashboardActionCenter from "@/app/components/DashboardActionCenter";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
  type KlyxDashboardMessageValues,
} from "@/lib/klyx-dashboard-i18n";
import ProviderActivitySnapshot from "./ProviderActivitySnapshot";

import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  ListPlus,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";

type Props = {
  firstName: string;
};

export default function ProviderDashboard({ firstName }: Props) {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxDashboardMessageKey,
    values?: KlyxDashboardMessageValues
  ) => translateKlyxDashboard(locale, key, values);

  const primaryActions = [
    {
      title: t("providerActionMissionsTitle"),
      description: t("providerActionMissionsDescription"),
      href: "/provider/jobs",
      icon: Search,
    },
    {
      title: t("providerActionServicesTitle"),
      description: t("providerActionServicesDescription"),
      href: "/provider",
      icon: BriefcaseBusiness,
    },
    {
      title: t("providerActionFinancesTitle"),
      description: t("providerActionFinancesDescription"),
      href: "/provider/payments",
      icon: Banknote,
    },
    {
      title: t("providerActionMessagesTitle"),
      description: t("providerActionMessagesDescription"),
      href: "/messages",
      icon: MessageCircle,
    },
    {
      title: t("providerActionProfileTitle"),
      description: t("providerActionProfileDescription"),
      href: "/profile",
      icon: UserRound,
    },
  ];

  const secondaryLinks = [
    {
      label: t("providerAssistant"),
      href: "/provider/assistant",
      icon: Sparkles,
    },
    {
      label: t("providerQuoteRequests"),
      href: "/provider/quotes",
      icon: FileText,
    },
    {
      label: t("bookings"),
      href: "/bookings",
      icon: CalendarDays,
    },
    {
      label: t("providerAddService"),
      href: "/provider/services/new",
      icon: ListPlus,
    },
    {
      label: t("providerScoreReviews"),
      href: "/scores",
      icon: Star,
    },
    {
      label: t("settings"),
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#111827_0%,#18233f_48%,#0f172a_100%)] p-7 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:p-10">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <BriefcaseBusiness size={15} />
            {t("providerTagline")}
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            {t("providerHello", {
              name: firstName || t("providerProfessionalFallback"),
            })}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {t("providerHeroDescription")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/provider/jobs"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950 shadow-lg transition hover:-translate-y-0.5"
            >
              <Search size={17} />
              {t("providerViewMissions")}
            </Link>

            <Link
              href="/provider"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <BriefcaseBusiness size={17} />
              {t("providerManageServices")}
            </Link>

            <Link
              href="/provider/payments"
              prefetch
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/14 bg-white/7 px-5 text-sm font-black text-white transition hover:bg-white/12"
            >
              <Banknote size={17} />
              {t("providerFinances")}
            </Link>
          </div>
        </div>
      </section>

      <DashboardActionCenter accountType="provider" />
      <ProviderActivitySnapshot />

      <section className="mt-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
          {t("providerNavEyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          {t("providerNavTitle")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("providerNavDescription")}
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                prefetch
                className="klyx-card klyx-card-hover group flex min-h-52 flex-col p-6"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                  <Icon size={22} />
                </div>
                <h3 className="mt-6 text-lg font-black tracking-[-0.025em]">
                  {action.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600 dark:text-blue-400">
                  {t("open")} <ChevronRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
          {t("providerSecondaryEyebrow")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {secondaryLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground transition hover:bg-muted"
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

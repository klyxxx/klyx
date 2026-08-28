"use client";

import Link from "next/link";

import {
  BriefcaseBusiness,
  Crown,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
  type KlyxDashboardMessageValues,
} from "@/lib/klyx-dashboard-i18n";
import NotificationBell from "./NotificationBell";

type HeaderProps = {
  email: string;
  displayName?: string;
  isFounder?: boolean;
  accountType?: "client" | "provider";
};

export default function Header({
  email,
  displayName,
  isFounder = false,
  accountType = "client",
}: HeaderProps) {
  const { locale } = useKlyxLocale();
  const t = (
    key: KlyxDashboardMessageKey,
    values?: KlyxDashboardMessageValues
  ) => translateKlyxDashboard(locale, key, values);
  const provider = accountType === "provider";
  const primaryHref = provider ? "/provider/jobs" : "/assistant/market";
  const primaryLabel = t(
    provider ? "headerProviderPrimary" : "headerClientPrimary"
  );

  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400">
          KLYX
        </p>

        {isFounder && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400">
              <Crown size={13} />
              FOUNDER
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-600 dark:text-violet-400">
              <ShieldCheck size={13} />
              SUPER ADMIN
            </span>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
            provider
              ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
              : "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
          }`}
        >
          {provider ? <BriefcaseBusiness size={15} /> : <UserRound size={15} />}
          {t(provider ? "headerActiveProvider" : "headerActiveClient")}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-foreground">
        {t("headerTitle")}
      </h1>

      <p className="mt-1 text-muted-foreground">
        {t("headerWelcome", {
          name: displayName ? `, ${displayName}` : "",
        })}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={primaryHref}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${
            provider
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-violet-600 hover:bg-violet-700"
          }`}
        >
          {provider ? <Search size={17} /> : <Sparkles size={17} />}
          {primaryLabel}
        </Link>

        <NotificationBell />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="max-w-[280px] truncate rounded-full border border-border bg-muted px-3 py-1.5">
          {email || t("headerUserFallback")}
        </span>
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 font-bold">
          {t(provider ? "headerProviderSpace" : "headerClientSpace")}
        </span>
        <Link href="/accounts" className="font-bold underline-offset-4 hover:underline">
          {t("headerManageProfiles")}
        </Link>
        <Link href="/settings" className="font-bold underline-offset-4 hover:underline">
          {t("headerSettings")}
        </Link>
      </div>

      {isFounder && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/founder"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700"
          >
            <Crown size={16} />
            {t("headerFounderConsole")}
          </Link>
          <Link
            href="/admin"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-black text-foreground transition hover:bg-muted"
          >
            <ShieldCheck size={16} />
            {t("headerAdmin")}
          </Link>
        </div>
      )}
    </header>
  );
}

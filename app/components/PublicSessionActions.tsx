"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  LoaderCircle,
  Search,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { translateKlyxPublicEntry } from "@/lib/klyx-page-i18n";

type Props = {
  compact?: boolean;
};

export default function PublicSessionActions({ compact = false }: Props) {
  const { locale } = useKlyxLocale();
  const t = (key: Parameters<typeof translateKlyxPublicEntry>[1]) =>
    translateKlyxPublicEntry(locale, key);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (active) {
          setConnected(Boolean(user));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className={`flex ${compact ? "items-center" : "justify-center"}`}>
        <div
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground ${
            compact ? "h-11 px-4" : "min-h-12 px-5"
          }`}
        >
          <LoaderCircle size={17} className="animate-spin" />
          {t("sessionLoading")}
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className={`flex ${compact ? "items-center gap-2" : "flex-col justify-center gap-3 sm:flex-row"}`}>
        <Link
          href="/dashboard"
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white transition hover:bg-blue-500 ${
            compact ? "h-11 px-4 text-sm" : "min-h-12 px-5 text-sm"
          }`}
        >
          {t("openKlyx")}
          <ArrowRight size={17} />
        </Link>

        <Link
          href="/accounts"
          className={`items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold transition hover:bg-muted ${
            compact ? "hidden h-11 px-4 text-sm sm:inline-flex" : "inline-flex min-h-12 px-5 text-sm"
          }`}
        >
          <UsersRound size={17} />
          {t("myProfiles")}
        </Link>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition hover:bg-muted sm:px-4"
        >
          {t("login")}
        </Link>
        <Link
          href="/signup?type=client"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          {t("start")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/signup?type=client"
          className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          <Search size={18} />
          <span>{t("clientNeedService")}</span>
          <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/signup?type=provider"
          className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 text-sm font-semibold transition hover:bg-muted"
        >
          <BriefcaseBusiness size={18} className="text-blue-600 dark:text-blue-400" />
          <span>{t("providerOfferServices")}</span>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>{t("alreadyAccount")}</span>
        <Link href="/login" className="font-semibold text-foreground hover:text-blue-600 dark:hover:text-blue-400">
          {t("signIn")}
        </Link>
      </div>
    </div>
  );
}

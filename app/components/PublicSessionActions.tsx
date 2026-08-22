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

export default function PublicSessionActions({
  compact = false,
}: Props) {
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

        if (!active) {
          return;
        }

        setConnected(Boolean(user));
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
      <div
        className={`flex items-center ${
          compact
            ? "gap-2"
            : "flex-col gap-3 sm:flex-row"
        }`}
      >
        <div
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/55 ${
            compact
              ? "h-11 px-4"
              : "min-h-14 px-6"
          }`}
        >
          <LoaderCircle
            size={17}
            className="animate-spin"
          />

          {t("sessionLoading")}
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div
        className={`flex ${
          compact
            ? "items-center gap-2"
            : "flex-col gap-3 sm:flex-row"
        }`}
      >
        {/* KLYX_CONNECTED_ENTRY_14_01 */}
        <Link
          href="/dashboard"
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 font-black text-white transition hover:bg-violet-500 ${
            compact
              ? "h-11 px-4 text-sm"
              : "min-h-14 px-6 text-base"
          }`}
        >
          {t("openKlyx")}
          <ArrowRight size={17} />
        </Link>

        <Link
          href="/accounts"
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-bold text-white/75 transition hover:bg-white/10 hover:text-white ${
            compact
              ? "hidden h-11 px-4 text-sm sm:inline-flex"
              : "min-h-14 px-6 text-base"
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
          className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/7"
        >
          {t("login")}
        </Link>

        {/* KLYX_PUBLIC_COMPACT_ENTRY_14_01 */}
        <Link
          href="/signup?type=client"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-500"
        >
          {t("start")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    /* KLYX_DUAL_PUBLIC_ENTRY_14_01 */
    <div className="w-full max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/signup?type=client"
          className="group flex min-h-20 items-center gap-4 rounded-2xl bg-violet-600 px-5 py-4 text-left text-white transition hover:bg-violet-500"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/12">
            <Search size={20} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-white/65">
              {t("client")}
            </span>

            <span className="mt-1 block font-black">
              {t("clientNeedService")}
            </span>
          </span>

          <ArrowRight
            size={19}
            className="shrink-0 transition group-hover:translate-x-1"
          />
        </Link>

        <Link
          href="/signup?type=provider"
          className="group flex min-h-20 items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.055] px-5 py-4 text-left text-white transition hover:bg-white/10"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/8 text-violet-300">
            <BriefcaseBusiness size={20} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-white/45">
              {t("provider")}
            </span>

            <span className="mt-1 block font-black">
              {t("providerOfferServices")}
            </span>
          </span>

          <ArrowRight
            size={19}
            className="shrink-0 transition group-hover:translate-x-1"
          />
        </Link>
      </div>

      {/* KLYX_EXISTING_ACCOUNT_ENTRY_14_01 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/48">
        <span>
          {t("alreadyAccount")}
        </span>

        <Link
          href="/login"
          className="font-black text-white/80 transition hover:text-white"
        >
          {t("signIn")}
        </Link>
      </div>
    </div>
  );
}

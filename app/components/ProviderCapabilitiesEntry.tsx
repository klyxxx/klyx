"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxProviderCapabilitiesPage,
  type KlyxProviderCapabilitiesPageMessageKey,
} from "@/lib/klyx-provider-capabilities-page-i18n";

export default function ProviderCapabilitiesEntry() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderCapabilitiesPageMessageKey) =>
    translateKlyxProviderCapabilitiesPage(locale, key);

  return (
    <section className="mb-5 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Sparkles size={18} />
          </span>

          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              {t("entryEyebrow")}
            </p>
            <h2 className="mt-1 text-base font-black sm:text-lg">
              {t("entryTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("entryDescription")}
            </p>
          </div>
        </div>

        <Link
          href="/provider/capabilities"
          prefetch
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-600/20 bg-blue-600/8 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-600/12 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300"
        >
          {t("entryCta")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

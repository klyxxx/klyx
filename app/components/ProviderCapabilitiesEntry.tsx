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
    <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-violet-500/20 bg-violet-500/[0.06] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
            <Sparkles size={21} />
          </span>

          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
              {t("entryEyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">
              {t("entryTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("entryDescription")}
            </p>
          </div>
        </div>

        <Link
          href="/provider/capabilities"
          prefetch
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-black text-background transition hover:opacity-90"
        >
          {t("entryCta")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

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
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600/8 text-blue-600">
            <Sparkles size={20} />
          </span>

          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              {t("entryEyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
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
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          {t("entryCta")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

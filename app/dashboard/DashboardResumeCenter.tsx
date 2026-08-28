"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Search,
  Sparkles,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxDashboard,
  type KlyxDashboardMessageKey,
} from "@/lib/klyx-dashboard-i18n";

export default function DashboardResumeCenter({
  accountType,
}: {
  accountType: "client" | "provider";
}) {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxDashboardMessageKey) =>
    translateKlyxDashboard(locale, key);
  const provider = accountType === "provider";

  return (
    <section
      className="mb-8 overflow-hidden rounded-3xl border border-border bg-card"
      data-klyx-contract="KLYX_DASHBOARD_I18N_16_08"
    >
      <div className="grid gap-px bg-border lg:grid-cols-[1fr_auto]">
        <div className="bg-card p-6 sm:p-7">
          <p
            className={`text-xs font-black uppercase tracking-[0.18em] ${
              provider
                ? "text-blue-600 dark:text-blue-400"
                : "text-violet-600 dark:text-violet-400"
            }`}
          >
            {t("resumeEyebrow")}
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
            {t(provider ? "resumeProviderTitle" : "resumeClientTitle")}
          </h2>
        </div>

        <div className="grid gap-3 bg-card p-6 lg:min-w-80">
          {provider ? (
            <>
              <Link
                href="/provider/jobs"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-500"
              >
                <BriefcaseBusiness size={18} />
                {t("resumeProviderPrimary")}
                <ArrowRight size={17} />
              </Link>

              <Link
                href="/provider"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
              >
                {t("resumeProviderSecondary")}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/assistant/market"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
              >
                <Sparkles size={18} />
                {t("resumeClientPrimary")}
                <ArrowRight size={17} />
              </Link>

              <Link
                href="/search"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-black transition hover:bg-muted"
              >
                <Search size={18} />
                {t("resumeClientSecondary")}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

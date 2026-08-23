"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Globe2,
  Laptop,
  LogIn,
  Share2,
  Smartphone,
} from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  translateKlyxInstallPage,
  type KlyxInstallPageMessageKey,
} from "@/lib/klyx-install-page-i18n";

// KLYX_INSTALL_PAGE_I18N_16_11
export default function InstallPageContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxInstallPageMessageKey) =>
    translateKlyxInstallPage(locale, key);

  return (
    <main className="min-h-screen bg-background dark:bg-[#09090b] text-foreground dark:text-white">
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold transition hover:bg-white/7"
          >
            <LogIn size={17} />
            {t("login")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-white/45 transition hover:text-foreground dark:text-white"
        >
          <ArrowLeft size={17} />
          {t("backHome")}
        </Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f_0%,#2b1452_55%,#111827_100%)] p-7 shadow-[0_28px_90px_rgba(44,20,85,0.25)] sm:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
              <Download size={15} />
              {t("badge")}
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              {t("heroTitle")}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/65">
              {t("heroDescription")}
            </p>

            <div className="mt-7">
              <InstallKlyxButton />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <InfoCard
            icon={<Smartphone size={22} />}
            title={t("androidTitle")}
            description={t("androidDescription")}
          />

          <InfoCard
            icon={<Share2 size={22} />}
            title={t("iosTitle")}
            description={t("iosDescription")}
          />

          <InfoCard
            icon={<Laptop size={22} />}
            title={t("desktopTitle")}
            description={t("desktopDescription")}
          />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              {t("benefitsEyebrow")}
            </p>

            <div className="mt-5 space-y-4">
              <CheckLine text={t("benefitIcon")} />
              <CheckLine text={t("benefitAppMode")} />
              <CheckLine text={t("benefitSameAccount")} />
              <CheckLine text={t("benefitNoStore")} />
            </div>
          </article>

          <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6 sm:p-8">
            <Globe2 size={26} className="text-violet-300" />

            <h2 className="mt-5 text-2xl font-black">{t("browserTitle")}</h2>

            <p className="mt-3 text-sm leading-7 text-white/48">
              {t("browserDescription")}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black transition hover:bg-violet-500"
              >
                {t("browserLogin")}
              </Link>

              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-black transition hover:bg-white/7"
              >
                {t("browserSignup")}
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="font-black">{t("currentVersionTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            {t("currentVersionDescription")}
          </p>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-300">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
    </article>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2
        size={18}
        className="mt-0.5 shrink-0 text-emerald-400"
      />
      <p className="text-sm leading-6 text-white/62">{text}</p>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Download,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import PublicSessionActions from "@/app/components/PublicSessionActions";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  translateKlyxPublicHome,
  type KlyxPublicHomeMessageKey,
} from "@/lib/klyx-page-i18n";

// KLYX_PUBLIC_PRODUCT_JOURNEY_13_84
// KLYX_PUBLIC_DUAL_ENTRY_13_85
// KLYX_PUBLIC_HOME_I18N_16_10

export default function PublicHomeContent() {
  const { locale } = useKlyxLocale();

  const t = (key: KlyxPublicHomeMessageKey) =>
    translateKlyxPublicHome(locale, key);

  const services = [
    t("serviceBabysitting"),
    t("serviceCleaning"),
    t("serviceMoving"),
    t("serviceHandyman"),
  ];

  const highlights = [
    {
      icon: Bot,
      title: t("highlightAssistantTitle"),
      description: t("highlightAssistantText"),
    },
    {
      icon: Search,
      title: t("highlightProvidersTitle"),
      description: t("highlightProvidersText"),
    },
    {
      icon: CalendarCheck2,
      title: t("highlightBookingTitle"),
      description: t("highlightBookingText"),
    },
    {
      icon: ShieldCheck,
      title: t("highlightTrustTitle"),
      description: t("highlightTrustText"),
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground dark:bg-[#09090b] dark:text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-background backdrop-blur-2xl dark:bg-[#09090b]/88">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/install"
              className="hidden h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Download size={16} />
              {t("install")}
            </Link>

            <PublicSessionActions compact />
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.28),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(37,99,235,0.18),transparent_24%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:pb-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200">
              <Sparkles size={16} />
              {t("heroBadge")}
            </div>

            <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[0.96] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
              {t("heroTitle")}
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/58 sm:text-xl">
              {t("heroDescription")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PublicSessionActions />

              <Link
                href="/install"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/12 px-6 text-base font-bold text-white/80 transition hover:bg-white/7 hover:text-white sm:hidden"
              >
                <Download size={19} />
                {t("installKlyx")}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/48">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                {t("freeAccount")}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                {t("browserReady")}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                {t("deviceInstallable")}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-violet-600/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/8 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                    {t("assistantLabel")}
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {t("assistantQuestion")}
                  </p>
                </div>

                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Bot size={22} />
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 p-5">
                <p className="text-sm leading-7 text-white/72">
                  {t("assistantExample")}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <ResultRow
                  icon={<Search size={18} />}
                  title={t("searchTitle")}
                  text={t("searchText")}
                />
                <ResultRow
                  icon={<BadgeCheck size={18} />}
                  title={t("trustTitle")}
                  text={t("trustText")}
                />
                <ResultRow
                  icon={<CalendarCheck2 size={18} />}
                  title={t("bookingTitle")}
                  text={t("bookingText")}
                />
              </div>

              <div className="mt-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5">
                <div className="flex items-center gap-3">
                  <Star size={20} />
                  <div>
                    <p className="font-black">{t("uniqueTitle")}</p>
                    <p className="mt-1 text-sm text-white/75">
                      {t("uniqueText")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-white/35">
            {t("launchServices")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {services.map((service) => (
              <span
                key={service}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* KLYX_PUBLIC_PRODUCT_JOURNEY_13_84 */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-400">
            {t("journeyEyebrow")}
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            {t("journeyTitle")}
          </h2>

          <p className="mt-5 text-base leading-7 text-white/50">
            {t("journeyIntro")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <JourneyStep
            number="01"
            title={t("journeyNeedTitle")}
            text={t("journeyNeedText")}
          />

          <JourneyStep
            number="02"
            title={t("journeyCompareTitle")}
            text={t("journeyCompareText")}
          />

          <JourneyStep
            number="03"
            title={t("journeyConfirmTitle")}
            text={t("journeyConfirmText")}
          />

          <JourneyStep
            number="04"
            title={t("journeyTrackTitle")}
            text={t("journeyTrackText")}
          />
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-[1.7rem] border border-emerald-500/15 bg-emerald-500/[0.05] p-5 sm:p-6">
          <ShieldCheck
            size={21}
            className="mt-0.5 shrink-0 text-emerald-400"
          />

          <div>
            <p className="font-black">{t("safetyTitle")}</p>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/50">
              {t("safetyDescription")}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-400">
            {t("platformEyebrow")}
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            {t("platformTitle")}
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-300">
                  <Icon size={22} />
                </span>

                <h3 className="mt-5 text-xl font-black">{item.title}</h3>

                <p className="mt-3 text-sm leading-7 text-white/48">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* KLYX_PUBLIC_DUAL_ENTRY_13_85 */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.025] p-7 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400">
              {t("joinEyebrow")}
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              {t("joinTitle")}
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/50 sm:text-base">
              {t("joinDescription")}
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-[1.8rem] border border-violet-500/20 bg-violet-500/[0.055] p-6 sm:p-8">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Search size={22} />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  {t("clientLabel")}
                </p>

                <h3 className="mt-2 text-2xl font-black">{t("clientTitle")}</h3>

                <p className="mt-3 max-w-lg text-sm leading-7 text-white/50">
                  {t("clientDescription")}
                </p>

                <div className="mt-6 space-y-2 text-sm text-white/60">
                  <PublicBenefit text={t("clientBenefitAssistant")} />
                  <PublicBenefit text={t("clientBenefitCompare")} />
                  <PublicBenefit text={t("clientBenefitTracking")} />
                </div>

                <Link
                  href="/signup?type=client"
                  className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-500"
                >
                  {t("clientCta")}
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[1.8rem] border border-blue-500/20 bg-blue-500/[0.055] p-6 sm:p-8">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-300">
                  <BadgeCheck size={22} />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-blue-300">
                  {t("providerLabel")}
                </p>

                <h3 className="mt-2 text-2xl font-black">
                  {t("providerTitle")}
                </h3>

                <p className="mt-3 max-w-lg text-sm leading-7 text-white/50">
                  {t("providerDescription")}
                </p>

                <div className="mt-6 space-y-2 text-sm text-white/60">
                  <PublicBenefit text={t("providerBenefitProfile")} />
                  <PublicBenefit text={t("providerBenefitOpportunities")} />
                  <PublicBenefit text={t("providerBenefitAssistant")} />
                </div>

                <Link
                  href="/signup?type=provider"
                  className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  {t("providerCta")}
                  <ArrowRight size={17} />
                </Link>
              </div>
            </article>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-emerald-400"
            />

            <p className="text-sm leading-6 text-white/50">{t("roleNote")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#2b1452_50%,#111827)] p-7 sm:p-10 lg:grid-cols-[1fr_0.75fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
              {t("deviceEyebrow")}
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
              {t("deviceTitle")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              {t("deviceDescription")}
            </p>

            <Link
              href="/install"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 text-sm font-black transition hover:bg-white/14"
            >
              <Download size={18} />
              {t("deviceOptions")}
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <InstallKlyxButton />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <KlyxLogo href="/" />
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="hover:text-foreground dark:text-white">
              {t("footerLogin")}
            </Link>
            <Link href="/signup" className="hover:text-foreground dark:text-white">
              {t("footerCreateAccount")}
            </Link>
            <Link href="/install" className="hover:text-foreground dark:text-white">
              {t("footerInstall")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PublicBenefit({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2
        size={16}
        className="mt-0.5 shrink-0 text-emerald-400"
      />

      <span>{text}</span>
    </div>
  );
}

function JourneyStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-[1.7rem] border border-white/8 bg-white/[0.035] p-6">
      <span className="text-xs font-black tracking-[0.18em] text-violet-400">
        {number}
      </span>

      <h3 className="mt-4 text-xl font-black">{title}</h3>

      <p className="mt-3 text-sm leading-7 text-white/48">{text}</p>
    </article>
  );
}

function ResultRow({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/7 text-violet-300">
        {icon}
      </span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/42">{text}</p>
      </div>
    </div>
  );
}

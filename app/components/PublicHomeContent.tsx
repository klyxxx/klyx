"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Download,
  Mic,
  ShieldCheck,
} from "lucide-react";

import InstallKlyxButton from "@/app/components/InstallKlyxButton";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import PublicSessionActions from "@/app/components/PublicSessionActions";
import KlyxLogo from "@/app/ui/KlyxLogo";
import {
  translateKlyxPublicHome,
  type KlyxPublicHomeMessageKey,
} from "@/lib/klyx-page-i18n";

export default function PublicHomeContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxPublicHomeMessageKey) =>
    translateKlyxPublicHome(locale, key);

  const assistantQuestion =
    locale === "fr"
      ? "Que dois-je organiser pour vous ?"
      : locale === "en"
        ? "What should I organize for you?"
        : locale === "nl"
          ? "Wat zal ik voor je organiseren?"
          : locale === "de"
            ? "Was soll ich für dich organisieren?"
            : t("assistantQuestion");

  const services = [
    t("serviceBabysitting"),
    t("serviceCleaning"),
    t("serviceMoving"),
    t("serviceHandyman"),
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <KlyxLogo href="/" />

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/install"
              className="hidden h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Download size={16} />
              {t("install")}
            </Link>

            <PublicSessionActions compact />
          </nav>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8 sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
          {t("heroBadge")}
        </p>

        <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-[-0.055em] sm:text-6xl lg:text-7xl">
          {assistantQuestion}
        </h1>

        <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-foreground/75 sm:text-lg">
          {t("heroTitle")}
        </p>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {t("heroDescription")}
        </p>

        <div className="mt-9 w-full max-w-3xl rounded-[1.75rem] border border-border bg-card p-4 text-left shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
              <span className="text-sm font-black">K</span>
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                {t("assistantLabel")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                {t("assistantExample")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-1 text-muted-foreground" aria-hidden="true">
              <span className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
                <Camera size={18} />
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
                <Mic size={18} />
              </span>
            </div>

            <p className="text-xs font-medium text-muted-foreground">
              {t("freeAccount")}
            </p>
          </div>
        </div>

        <div className="mt-6 w-full max-w-3xl">
          <PublicSessionActions />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
          {services.map((service) => (
            <span key={service}>{service}</span>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {t("journeyEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
              {t("journeyTitle")}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              {t("journeyIntro")}
            </p>
          </div>

          <div className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-border bg-background p-5">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-semibold">{t("safetyTitle")}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("safetyDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            {t("joinEyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            {t("joinTitle")}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            {t("joinDescription")}
          </p>
        </div>

        <div className="mx-auto mt-9 grid max-w-4xl gap-4 md:grid-cols-2">
          <article className="rounded-[1.6rem] border border-border bg-card p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              {t("clientLabel")}
            </p>
            <h3 className="mt-2 text-xl font-bold">{t("clientTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("clientDescription")}
            </p>
            <Link
              href="/signup?type=client"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              {t("clientCta")}
              <ArrowRight size={16} />
            </Link>
          </article>

          <article className="rounded-[1.6rem] border border-border bg-card p-6 sm:p-7">
            <Link
              href="/signup?type=provider"
              className="mt-6 inline-flex text-xs font-black uppercase tracking-[0.18em] text-blue-600 transition hover:text-blue-500 dark:text-blue-400"
            >
              {t("providerLabel")}
            </Link>
            <h3 className="mt-2 text-xl font-bold">{t("providerTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("providerDescription")}
            </p>
            <Link
              href="/signup?type=provider"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition hover:bg-muted"
            >
              {t("providerCta")}
              <ArrowRight size={16} />
            </Link>
          </article>
        </div>

        <div className="mx-auto mt-5 flex max-w-4xl items-start gap-3 px-1 text-sm leading-6 text-muted-foreground">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p>{t("roleNote")}</p>
        </div>
      </section>

      <section className="border-t border-border/70">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {t("deviceEyebrow")}
            </p>
            <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              {t("deviceTitle")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("deviceDescription")}
            </p>
            <Link
              href="/install"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t("deviceOptions")}
              <ArrowRight size={16} />
            </Link>
          </div>

          <InstallKlyxButton />
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <KlyxLogo href="/" />
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="transition hover:text-foreground">
              {t("footerLogin")}
            </Link>
            <Link href="/signup" className="transition hover:text-foreground">
              {t("footerCreateAccount")}
            </Link>
            <Link href="/install" className="transition hover:text-foreground">
              {t("footerInstall")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
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
    <article className="border-t border-border pt-5">
      <span className="text-xs font-bold tracking-[0.18em] text-blue-600 dark:text-blue-400">
        {number}
      </span>
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

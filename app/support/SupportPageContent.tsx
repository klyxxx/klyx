"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CreditCard,
  Headphones,
  Mail,
  ShieldAlert,
} from "lucide-react";

import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";
import {
  translateKlyxSupportPage,
  type KlyxSupportPageMessageKey,
} from "@/lib/klyx-support-page-i18n";

function supportHref(subject: string, body: string) {
  return `mailto:${KLYX_PUBLIC_CONFIG.supportEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

// KLYX_SUPPORT_PAGE_I18N
export default function SupportPageContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxSupportPageMessageKey) =>
    translateKlyxSupportPage(locale, key);
  const email = KLYX_PUBLIC_CONFIG.supportEmail;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← {t("backLegal")}
        </Link>

        <Headphones className="mt-10 text-violet-600" size={38} />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={supportHref(t("generalSubject"), t("generalBody"))}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-6 font-black text-white transition hover:bg-violet-700"
          >
            <Mail size={18} />
            {t("contactSupport")}
          </a>

          <a
            href={`mailto:${email}`}
            className="inline-flex min-h-12 items-center rounded-2xl border border-border bg-card px-6 font-black"
          >
            {email}
          </a>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <SupportCard
            icon={<CreditCard />}
            title={t("paymentTitle")}
            text={t("paymentDescription")}
            href={supportHref(t("paymentSubject"), t("paymentBody"))}
            openLabel={t("open")}
          />
          <SupportCard
            icon={<ShieldAlert />}
            title={t("securityTitle")}
            text={t("securityDescription")}
            href={supportHref(t("securitySubject"), t("securityBody"))}
            openLabel={t("open")}
          />
        </div>

        <p className="mt-8 text-sm leading-6 text-muted-foreground">
          {t("fallbackBeforeEmail")} {" "}
          <strong className="text-foreground">{email}</strong> {" "}
          {t("fallbackAfterEmail")}
        </p>
      </div>

      <KlyxPublicFooter />
    </main>
  );
}

function SupportCard({
  icon,
  title,
  text,
  href,
  openLabel,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  href: string;
  openLabel: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="text-violet-600">{icon}</div>
      <h2 className="mt-4 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      <span className="mt-4 inline-block text-sm font-black text-violet-600">
        {openLabel} →
      </span>
    </a>
  );
}

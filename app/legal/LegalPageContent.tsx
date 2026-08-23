"use client";

import Link from "next/link";
import {
  FileText,
  Headphones,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxLegalPage,
  type KlyxLegalPageMessageKey,
} from "@/lib/klyx-legal-page-i18n";

// KLYX_LEGAL_PAGE_I18N
export default function LegalPageContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxLegalPageMessageKey) =>
    translateKlyxLegalPage(locale, key);

  const cards = [
    {
      href: "/privacy",
      title: t("privacyTitle"),
      description: t("privacyDescription"),
      icon: ShieldCheck,
    },
    {
      href: "/terms",
      title: t("termsTitle"),
      description: t("termsDescription"),
      icon: FileText,
    },
    {
      href: "/support",
      title: t("supportTitle"),
      description: t("supportDescription"),
      icon: Headphones,
    },
    {
      href: "/delete-account",
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      icon: Trash2,
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-bold text-violet-600">
          ← KLYX
        </Link>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-violet-600">
          {t("badge")}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Icon className="text-violet-600" size={26} />
                <h2 className="mt-5 text-xl font-black">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <KlyxPublicFooter />
    </main>
  );
}

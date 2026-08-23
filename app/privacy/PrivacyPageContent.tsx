"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";
import {
  translateKlyxPrivacyPage,
  type KlyxPrivacyPageMessageKey,
} from "@/lib/klyx-privacy-page-i18n";

// KLYX_PRIVACY_PAGE_I18N
export default function PrivacyPageContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxPrivacyPageMessageKey) =>
    translateKlyxPrivacyPage(locale, key);
  const config = KLYX_PUBLIC_CONFIG;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← {t("backLegal")}
        </Link>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-violet-600">
          {t("lastUpdated")}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          {t("title")}
        </h1>

        <div className="mt-10 space-y-9 text-sm leading-7 text-muted-foreground sm:text-base">
          <Section title={t("section1Title")}>
            <p>
              {t("controllerIntro")}
              <strong className="text-foreground"> {config.legalName}</strong>.
            </p>
            {config.legalAddress && (
              <p>
                {t("addressLabel")} {config.legalAddress}
              </p>
            )}
            {config.companyNumber && (
              <p>
                {t("companyNumberLabel")} {config.companyNumber}
              </p>
            )}
            <p>
              {t("privacyContactLabel")} {" "}
              <a
                className="font-bold text-violet-600"
                href={`mailto:${config.supportEmail}`}
              >
                {config.supportEmail}
              </a>
            </p>
          </Section>

          <Section title={t("section2Title")}>
            <p>{t("section2AccountText")}</p>
            <p>{t("section2PaymentText")}</p>
            <p>{t("section2OptionalText")}</p>
          </Section>

          <Section title={t("section3Title")}>
            <p>{t("section3Text")}</p>
          </Section>

          <Section title={t("section4Title")}>
            <p>{t("section4Text")}</p>
          </Section>

          <Section title={t("section5Title")}>
            <p>{t("section5Text")}</p>
          </Section>

          <Section title={t("section6Title")}>
            <p>
              {t("deletionIntro")} {" "}
              <Link className="font-bold text-violet-600" href="/delete-account">
                /delete-account
              </Link>
              . {" "}
              {t("deletionAfterLink")}
            </p>
            <p>
              {t("rightsIntro")} {config.supportEmail}.
            </p>
          </Section>

          <Section title={t("section7Title")}>
            <p>{t("section7Text")}</p>
          </Section>

          <Section title={t("section8Title")}>
            <p>{t("section8Text")}</p>
          </Section>
        </div>
      </article>

      <KlyxPublicFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-black text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

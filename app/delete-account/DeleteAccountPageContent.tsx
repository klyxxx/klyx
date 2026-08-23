"use client";

import Link from "next/link";
import { ShieldCheck, Trash2 } from "lucide-react";

import KlyxPublicFooter from "@/app/components/KlyxPublicFooter";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { KLYX_PUBLIC_CONFIG } from "@/lib/klyx-public-config";
import {
  translateKlyxDeleteAccountPage,
  type KlyxDeleteAccountPageMessageKey,
} from "@/lib/klyx-delete-account-page-i18n";

// KLYX_DELETE_ACCOUNT_PAGE_I18N
export default function DeleteAccountPageContent() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxDeleteAccountPageMessageKey) =>
    translateKlyxDeleteAccountPage(locale, key);
  const email = KLYX_PUBLIC_CONFIG.supportEmail;
  const subject = encodeURIComponent(t("emailSubject"));
  const body = encodeURIComponent(
    [
      t("emailGreeting"),
      "",
      t("emailRequest"),
      "",
      `${t("emailAccountLabel")} `,
      "",
      t("emailIdentityAcknowledgement"),
    ].join("\n")
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/legal" className="text-sm font-bold text-violet-600">
          ← {t("backLegal")}
        </Link>

        <Trash2 className="mt-10 text-rose-600" size={40} />
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
          {t("description")}
        </p>

        <section className="mt-9 rounded-3xl border border-border bg-card p-6">
          <h2 className="text-xl font-black">{t("fromKlyxTitle")}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("fromKlyxDescription")}
          </p>
          <Link
            href="/settings"
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-violet-600 px-5 font-black text-white"
          >
            {t("openSettings")}
          </Link>
        </section>

        <section className="mt-5 rounded-3xl border border-rose-500/25 bg-rose-500/[0.05] p-6">
          <h2 className="text-xl font-black">{t("webRequestTitle")}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("webRequestDescription")}
          </p>

          <a
            href={`mailto:${email}?subject=${subject}&body=${body}`}
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-rose-600 px-5 font-black text-white"
          >
            {t("requestDeletion")}
          </a>

          <p className="mt-3 text-xs text-muted-foreground">
            {t("processingAddress")} {email}
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-6">
          <div className="flex gap-3">
            <ShieldCheck className="shrink-0 text-violet-600" />
            <div>
              <h2 className="font-black">{t("retainedTitle")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("retainedDescription")}
              </p>
            </div>
          </div>
        </section>
      </article>

      <KlyxPublicFooter />
    </main>
  );
}

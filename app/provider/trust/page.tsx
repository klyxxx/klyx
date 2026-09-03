"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import { getActiveProfileAccount } from "@/lib/account-switcher";
import {
  getKlyxTrustIntlLocale,
  translateKlyxTrustReason,
  translateKlyxTrustStatus,
} from "@/lib/klyx-trust-page-i18n";
import {
  translateKlyxProviderTrust,
  type KlyxProviderTrustMessageKey,
} from "@/lib/klyx-provider-trust-page-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_TRUST_I18N

type Dispute = {
  id: string;
  booking_id: string;
  opened_by: string;
  against_profile_id: string | null;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  created_at: string;
};

export default function ProviderTrustPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderTrustMessageKey) =>
    translateKlyxProviderTrust(locale, key);
  const [profileId, setProfileId] = useState("");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const profile = await getActiveProfileAccount();

        if (profile.accountType !== "provider") {
          setErrorMessage(t("loadError"));
          return;
        }

        setProfileId(profile.id);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setErrorMessage(t("sessionMissing"));
          return;
        }

        const response = await fetch("/api/disputes", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = (await response.json()) as {
          disputes?: Dispute[];
          error?: string;
        };

        if (!response.ok) {
          setErrorMessage(t("loadError"));
          return;
        }

        setDisputes(result.disputes ?? []);
      } catch {
        setErrorMessage(t("loadError"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [locale]);

  const received = useMemo(
    () => disputes.filter((dispute) => dispute.against_profile_id === profileId),
    [disputes, profileId]
  );

  const opened = useMemo(
    () => disputes.filter((dispute) => dispute.opened_by === profileId),
    [disputes, profileId]
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
            <ShieldCheck size={17} />
            <span>{t("eyebrow")}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </header>

        {loading && (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle className="animate-spin text-blue-600" size={34} />
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <div className="mt-10 space-y-10">
            <DisputeSection
              title={t("receivedTitle")}
              description={t("receivedDescription")}
              disputes={received}
              emptyText={t("receivedEmpty")}
              viewMissionLabel={t("viewMission")}
              locale={locale}
            />

            <DisputeSection
              title={t("openedTitle")}
              description={t("openedDescription")}
              disputes={opened}
              emptyText={t("openedEmpty")}
              viewMissionLabel={t("viewMission")}
              locale={locale}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function DisputeSection({
  title,
  description,
  disputes,
  emptyText,
  viewMissionLabel,
  locale,
}: {
  title: string;
  description: string;
  disputes: Dispute[];
  emptyText: string;
  viewMissionLabel: string;
  locale: Parameters<typeof translateKlyxTrustReason>[0];
}) {
  return (
    <section>
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      {disputes.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={22} />
          </span>
          <p className="mt-4 font-semibold">{emptyText}</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {disputes.map((dispute, index) => (
            <article
              key={dispute.id}
              className={`p-5 sm:p-6 ${index > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={20} />
                  </span>

                  <div className="min-w-0">
                    <h3 className="font-semibold">
                      {translateKlyxTrustReason(locale, dispute.reason)}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {dispute.description}
                    </p>

                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 size={14} />
                      {new Intl.DateTimeFormat(getKlyxTrustIntlLocale(locale), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(dispute.created_at))}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <span className="rounded-full border border-blue-500/20 bg-blue-600/8 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {translateKlyxTrustStatus(locale, dispute.status)}
                  </span>

                  <Link
                    href={`/bookings/${dispute.booking_id}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-400"
                  >
                    {viewMissionLabel}
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileWarning,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxTrustIntlLocale,
  translateKlyxTrust,
  translateKlyxTrustReason,
  translateKlyxTrustStatus,
  type KlyxTrustMessageKey,
} from "@/lib/klyx-trust-page-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_TRUST_OVERVIEW_I18N

type Dispute = {
  id: string;
  booking_id: string;
  opened_by: string;
  against_profile_id: string | null;
  reason: string;
  description: string;
  status: string;
  priority: string;
  resolution: string | null;
  created_at: string;
};

type DisputesResponse = {
  disputes?: Dispute[];
};

export default function ClientTrustPage() {
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: KlyxTrustMessageKey) => translateKlyxTrust(locale, key),
    [locale]
  );

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setErrorMessage(t("sessionMissing"));
          }
          return;
        }

        const response = await fetch("/api/disputes", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (!cancelled) {
            setErrorMessage(t("loadError"));
          }
          return;
        }

        const result = (await response.json()) as DisputesResponse;
        if (!cancelled) {
          setDisputes(result.disputes ?? []);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage(t("loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const intlLocale = getKlyxTrustIntlLocale(locale);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#17131f,#3b162f_52%,#111827)] p-7 text-white sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/70">
            <ShieldCheck size={15} />
            {t("eyebrow")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">{t("title")}</h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>

          <Link
            href="/trust/new"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-zinc-950"
          >
            {t("openReport")}
            <ArrowRight size={17} />
          </Link>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <TrustInfo
            icon={<FileWarning size={21} />}
            title={t("factsTitle")}
            text={t("factsText")}
          />
          <TrustInfo
            icon={<ShieldCheck size={21} />}
            title={t("protectedTitle")}
            text={t("protectedText")}
          />
          <TrustInfo
            icon={<Clock3 size={21} />}
            title={t("decisionTitle")}
            text={t("decisionText")}
          />
        </section>

        {loading && (
          <div className="mt-8 grid min-h-52 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" size={36} />
          </div>
        )}

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <section className="mt-8">
            <p className="klyx-eyebrow">{t("filesEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-black">{t("filesTitle")}</h2>

            {disputes.length === 0 ? (
              <div className="klyx-card mt-5 p-8 text-center">
                <ShieldCheck className="mx-auto text-emerald-500" size={42} />
                <h3 className="mt-4 text-xl font-black">{t("emptyTitle")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("emptyText")}</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {disputes.map((dispute) => (
                  <article key={dispute.id} className="klyx-card p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                          <AlertTriangle size={21} />
                        </div>

                        <div>
                          <h3 className="font-black">
                            {translateKlyxTrustReason(locale, dispute.reason)}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {dispute.description}
                          </p>

                          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 size={14} />
                            {new Date(dispute.created_at).toLocaleString(intlLocale)}
                          </p>
                        </div>
                      </div>

                      <span className="w-fit rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 dark:text-violet-300">
                        {translateKlyxTrustStatus(locale, dispute.status)}
                      </span>
                    </div>

                    <Link
                      href={`/bookings/${dispute.booking_id}`}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-600 dark:text-violet-400"
                    >
                      {t("viewBooking")}
                      <ArrowRight size={15} />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function TrustInfo({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="klyx-card p-5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
        {icon}
      </div>
      <h3 className="mt-4 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

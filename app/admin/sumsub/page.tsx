"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  displayKlyxAdminSumsubProviderName,
  translateKlyxAdminSumsub,
  translateKlyxAdminSumsubAnswer,
  translateKlyxAdminSumsubKlyxStatus,
  translateKlyxAdminSumsubRejectType,
  type KlyxAdminSumsubMessageKey,
} from "@/lib/klyx-admin-sumsub-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_ADMIN_SUMSUB_I18N

type Row = {
  id: string;
  profile_id: string;
  status: string;
  external_applicant_id: string | null;
  external_review_status: string | null;
  external_review_answer: string | null;
  external_reject_type: string | null;
  external_moderation_comment: string | null;
  external_sandbox_mode: boolean | null;
  external_updated_at: string | null;
  providerName: string;
};

export default function AdminSumsubPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAdminSumsubMessageKey) =>
    translateKlyxAdminSumsub(locale, key);

  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] =
    useState<KlyxAdminSumsubMessageKey | null>(null);

  async function load() {
    setLoading(true);
    setErrorKey(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch(
        "/api/admin/sumsub",
        {
          cache: "no-store",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        rows?: Row[];
      };

      if (!response.ok) {
        setErrorKey("loadError");
        return;
      }

      setRows(body.rows ?? []);
    } catch {
      setErrorKey("loadError");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();

    if (!needle) return rows;

    return rows.filter((row) =>
      [
        row.providerName,
        row.status,
        row.external_review_status,
        row.external_review_answer,
        row.external_applicant_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, rows]);

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft size={17} />
          {t("backAdmin")}
        </Link>

        <section className="mt-6 rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#2b1452_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            {t("readOnly")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="klyx-input pl-11"
            />
          </label>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-black"
          >
            <RefreshCw size={17} />
            {t("refresh")}
          </button>
        </div>

        {errorKey && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t(errorKey)}
          </div>
        )}

        {loading ? (
          <div className="klyx-card mt-6 grid min-h-56 place-items-center">
            <LoaderCircle
              className="animate-spin"
              size={38}
            />
          </div>
        ) : filtered.length === 0 ? (
          <section className="klyx-card mt-6 p-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </section>
        ) : (
          <section className="mt-6 grid gap-4">
            {filtered.map((row) => (
              <article
                key={row.id}
                className="klyx-card p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">
                      {displayKlyxAdminSumsubProviderName(
                        locale,
                        row.providerName
                      )}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.external_applicant_id ?? t("applicantPending")}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black ${
                      row.external_review_answer === "GREEN"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : row.external_review_answer === "RED"
                          ? "bg-rose-500/10 text-rose-600"
                          : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {row.external_review_answer === "GREEN" && (
                      <BadgeCheck size={17} />
                    )}
                    {translateKlyxAdminSumsubAnswer(
                      locale,
                      row.external_review_answer,
                      row.external_review_status
                    )}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="font-bold">{t("klyxLabel")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {translateKlyxAdminSumsubKlyxStatus(
                        locale,
                        row.status
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">{t("environment")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {row.external_sandbox_mode
                        ? t("sandbox")
                        : t("production")}
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">{t("rejectType")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {translateKlyxAdminSumsubRejectType(
                        locale,
                        row.external_reject_type
                      )}
                    </p>
                  </div>
                </div>

                {row.external_moderation_comment && (
                  <p className="mt-5 rounded-xl bg-muted p-4 text-sm">
                    {row.external_moderation_comment}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxAdminSkillExperience,
  translateKlyxAdminSkillDocumentStatus,
  translateKlyxAdminSkills,
  translateKlyxAdminSkillStatus,
  type KlyxAdminSkillsMessageKey,
} from "@/lib/klyx-admin-skills-i18n";
import { createClient } from "@/lib/supabase/client";

// KLYX_ADMIN_SKILLS_I18N

type DocumentRow = {
  id: string;
  proof_type: string;
  original_name: string;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string;
};

type Verification = {
  id: string;
  profile_id: string;
  user_service_id: string;
  status: string;
  provider_statement: string | null;
  years_experience: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  providerName: string;
  providerCity: string;
  serviceName: string;
  serviceSlug: string;
  documents: DocumentRow[];
};

export default function AdminSkillsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxAdminSkillsMessageKey) =>
    translateKlyxAdminSkills(locale, key);

  const [rows, setRows] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [errorKey, setErrorKey] =
    useState<KlyxAdminSkillsMessageKey | null>(null);

  async function token() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async function load() {
    setLoading(true);
    setErrorKey(null);

    try {
      const accessToken = await token();

      if (!accessToken) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch(
        "/api/admin/skill-verifications",
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        verifications?: Verification[];
      };

      if (!response.ok) {
        setErrorKey("loadError");
        return;
      }

      setRows(body.verifications ?? []);
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
    const needle = query.trim().toLowerCase();

    if (!needle) return rows;

    return rows.filter((row) =>
      [
        row.providerName,
        row.providerCity,
        row.serviceName,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, rows]);

  async function preview(documentId: string) {
    setErrorKey(null);

    try {
      const accessToken = await token();

      if (!accessToken) {
        setErrorKey("sessionMissing");
        return;
      }

      const response = await fetch(
        "/api/admin/skill-verifications/document",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ documentId }),
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
      };

      if (!response.ok || !body.url) {
        setErrorKey("openError");
        return;
      }

      window.open(
        body.url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch {
      setErrorKey("openError");
    }
  }

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
            {t("eyebrow")}
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            {t("description")}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <p className="font-black">
            {t("authorityTitle")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("authorityText")}
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
              onChange={(event) =>
                setQuery(event.target.value)
              }
              className="klyx-input pl-11"
              placeholder={t("searchPlaceholder")}
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
          <section className="mt-6 grid gap-5">
            {filtered.map((row) => (
              <article
                key={row.id}
                className="klyx-card p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                      {row.serviceName}
                    </p>
                    <h2 className="mt-2 text-xl font-black">
                      {row.providerName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.providerCity || t("cityMissing")}
                      {" · "}
                      {formatKlyxAdminSkillExperience(
                        locale,
                        row.years_experience
                      )}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-black">
                    {row.status === "approved" && (
                      <BadgeCheck
                        size={17}
                        className="text-emerald-500"
                      />
                    )}
                    {translateKlyxAdminSkillStatus(
                      locale,
                      row.status
                    )}
                  </span>
                </div>

                {row.provider_statement && (
                  <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-6">
                    {row.provider_statement}
                  </p>
                )}

                {row.review_note && (
                  <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                    {t("decisionPrefix")} {row.review_note}
                  </p>
                )}

                <div className="mt-5">
                  <p className="text-sm font-black">
                    {t("documentsTitle")}
                  </p>

                  {row.documents.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("noDocuments")}
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {row.documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
                        >
                          <FileText
                            size={18}
                            className="text-violet-600"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black">
                              {document.original_name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {document.proof_type}
                              {" · "}
                              {translateKlyxAdminSkillDocumentStatus(
                                locale,
                                document.status
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void preview(document.id)
                            }
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-black"
                          >
                            <Eye size={15} />
                            {t("view")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

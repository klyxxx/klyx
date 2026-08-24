"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  translateKlyxFounderCleanup,
  type KlyxFounderCleanupMessageKey,
} from "@/lib/klyx-founder-cleanup-i18n";

// KLYX_FOUNDER_CLEANUP_I18N

type AccountAudit = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  protected: boolean;
  protectionReasons: string[];
  profileIdReferences: Array<{
    id: string;
    accountType: string | null;
    name: string;
  }>;
  ownedProfiles: Array<{
    id: string;
    accountType: string | null;
    name: string;
  }>;
};

type AuditResponse = {
  founderUserId?: string;
  totalUsers?: number;
  protectedUsers?: number;
  unreferencedUsers?: number;
  users?: AccountAudit[];
};

export default function FounderCleanupPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxFounderCleanupMessageKey) =>
    translateKlyxFounderCleanup(locale, key);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleteErrorKey, setDeleteErrorKey] = useState<"deleteRejected" | "deleteFailed" | null>(null);
  const [deletedIdentity, setDeletedIdentity] = useState("");
  const [target, setTarget] = useState<AccountAudit | null>(null);
  const [confirmation, setConfirmation] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const response = await fetch("/api/founder/accounts-audit", {
        cache: "no-store",
      });
      const body = (await response.json()) as AuditResponse;

      if (!response.ok) {
        setData(null);
        setLoadFailed(true);
        return;
      }

      setData(body);
    } catch {
      setData(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const users = data?.users ?? [];
  const candidateCount = useMemo(
    () => users.filter((user) => !user.protected).length,
    [users]
  );

  function openDelete(user: AccountAudit) {
    if (user.protected) return;
    setTarget(user);
    setConfirmation("");
    setDeleteErrorKey(null);
    setDeletedIdentity("");
  }

  function closeDelete() {
    if (deleting) return;
    setTarget(null);
    setConfirmation("");
  }

  async function deleteAccount() {
    if (!target) return;

    setDeleting(true);
    setDeleteErrorKey(null);
    setDeletedIdentity("");

    try {
      const response = await fetch("/api/founder/accounts-cleanup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: target.id,
          confirmation,
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        deletedEmail?: string | null;
      };

      if (!response.ok) {
        setDeleteErrorKey("deleteRejected");
        return;
      }

      setDeletedIdentity(body.deletedEmail || target.email || target.id);
      setTarget(null);
      setConfirmation("");
      await load();
    } catch {
      setDeleteErrorKey("deleteFailed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} /> {t("backAdmin")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Crown size={15} /> {t("badge")}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">{t("description")}</p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {t("refresh")}
          </button>
        </section>

        {loadFailed && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t("loadError")}
          </div>
        )}

        {deleteErrorKey && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {t(deleteErrorKey)}
          </div>
        )}

        {deletedIdentity && (
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600">
            {t("deletedPrefix")}: {deletedIdentity}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric label={t("authUsers")} value={data.totalUsers ?? 0} />
              <Metric label={t("protectedAccounts")} value={data.protectedUsers ?? 0} />
              <Metric label={t("deletableToConfirm")} value={candidateCount} />
            </section>

            <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <ShieldAlert size={22} className="shrink-0 text-amber-600" />
                <div>
                  <p className="font-black">{t("permanentDeletion")}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("warningDescription")}</p>
                </div>
              </div>
            </section>

            <section className="mt-8 space-y-4">
              {users.map((user) => (
                <article
                  key={user.id}
                  className={`rounded-3xl border p-6 ${
                    user.protected
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : "border-amber-500/20 bg-amber-500/10"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <UserRound size={20} />
                        <h2 className="font-black">{user.email || t("noEmail")}</h2>
                        {user.protected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-600">
                            <LockKeyhole size={12} /> {t("protected")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-600">
                            {t("deletable")}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{user.id}</p>

                      {user.protectionReasons.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {user.protectionReasons.map((reason) => (
                            <p key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}

                      {user.ownedProfiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{t("ownedProfiles")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user.ownedProfiles.map((profile) => (
                              <span
                                key={profile.id}
                                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold"
                              >
                                {profile.accountType ?? t("profileFallback")} · {profile.name || profile.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={user.protected}
                      onClick={() => openDelete(user)}
                      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black ${
                        user.protected
                          ? "cursor-not-allowed border border-border opacity-40"
                          : "bg-rose-600 text-white transition hover:bg-rose-700"
                      }`}
                    >
                      <Trash2 size={16} /> {t("delete")}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4">
          <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">{t("modalEyebrow")}</p>
                <h2 className="mt-2 text-2xl font-black">{t("modalTitle")}</h2>
              </div>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="grid h-10 w-10 place-items-center rounded-xl border border-border"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              {t("account")}: <strong className="ml-1 text-foreground">{target.email || target.id}</strong>
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("confirmInstruction")}</p>
            <code className="mt-2 block break-all rounded-xl bg-muted p-3 text-xs font-bold">
              SUPPRIMER {target.id}
            </code>

            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={t("confirmationPlaceholder")}
              className="mt-4 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-rose-500"
            />

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-black"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleting || confirmation !== `SUPPRIMER ${target.id}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-black text-white disabled:opacity-40"
              >
                {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t("deletePermanently")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  deletionEnabled?: boolean;
  deletionMessage?: string;
  error?: string;
};

export default function FounderCleanupPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/founder/accounts-audit",
        { cache: "no-store" }
      );

      const body = (await response.json()) as AuditResponse;

      if (!response.ok) {
        throw new Error(body.error || "Audit impossible.");
      }

      setData(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Audit impossible."
      );
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

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/founder"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={17} />
          Console Founder
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Crown size={15} />
            Étape 11.3
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Audit des anciens comptes
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Avant de supprimer un ancien utilisateur Auth, KLYX vérifie
            s’il possède encore un profil ou si son UID est encore utilisé
            comme identifiant d’un profil. Les comptes référencés restent
            protégés.
          </p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            Relancer l’audit
          </button>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric
                label="Utilisateurs Auth"
                value={data.totalUsers ?? 0}
              />
              <Metric
                label="Comptes protégés"
                value={data.protectedUsers ?? 0}
              />
              <Metric
                label="À examiner"
                value={candidateCount}
              />
            </section>

            <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <ShieldAlert
                  size={22}
                  className="shrink-0 text-amber-600"
                />
                <div>
                  <p className="font-black">
                    Suppression volontairement désactivée en 11.3
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {data.deletionMessage}
                    {" "}Un compte marqué « À examiner » n’est pas encore
                    automatiquement considéré supprimable : d’autres tables
                    KLYX peuvent encore le référencer.
                  </p>
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

                        <h2 className="font-black">
                          {user.email || "Utilisateur sans e-mail"}
                        </h2>

                        {user.protected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-600">
                            <LockKeyhole size={12} />
                            PROTÉGÉ
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-600">
                            À EXAMINER
                          </span>
                        )}
                      </div>

                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                        {user.id}
                      </p>

                      {user.protectionReasons.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {user.protectionReasons.map((reason) => (
                            <p
                              key={reason}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <CheckCircle2
                                size={16}
                                className="mt-0.5 shrink-0 text-emerald-500"
                              />
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}

                      {user.ownedProfiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                            Profils possédés
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user.ownedProfiles.map((profile) => (
                              <span
                                key={profile.id}
                                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold"
                              >
                                {profile.accountType ?? "profil"} ·{" "}
                                {profile.name || profile.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {user.profileIdReferences.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                            UID encore utilisé comme profile.id
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user.profileIdReferences.map((profile) => (
                              <span
                                key={profile.id}
                                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold"
                              >
                                {profile.accountType ?? "profil"} ·{" "}
                                {profile.name || profile.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled
                      title="Suppression désactivée pendant l’audit 11.3"
                      className="inline-flex h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-xl border border-border px-4 text-sm font-black opacity-40"
                    >
                      <Trash2 size={16} />
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-bold text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  error?: string;
};

export default function FounderCleanupPage() {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [data, setData] =
    useState<AuditResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [target, setTarget] =
    useState<AccountAudit | null>(null);
  const [confirmation, setConfirmation] =
    useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/founder/accounts-audit",
        { cache: "no-store" }
      );

      const body =
        (await response.json()) as AuditResponse;

      if (!response.ok) {
        throw new Error(
          body.error || "Audit impossible."
        );
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
    () =>
      users.filter(
        (user) => !user.protected
      ).length,
    [users]
  );

  function openDelete(user: AccountAudit) {
    if (user.protected) {
      return;
    }

    setTarget(user);
    setConfirmation("");
    setError("");
    setMessage("");
  }

  function closeDelete() {
    if (deleting) {
      return;
    }

    setTarget(null);
    setConfirmation("");
  }

  async function deleteAccount() {
    if (!target) {
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/founder/accounts-cleanup",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId: target.id,
            confirmation,
          }),
        }
      );

      const body =
        (await response.json()) as {
          success?: boolean;
          deletedEmail?: string | null;
          error?: string;
          protectionReasons?: string[];
        };

      if (!response.ok) {
        const extra =
          body.protectionReasons?.length
            ? ` ${body.protectionReasons.join(
                " · "
              )}`
            : "";

        throw new Error(
          `${body.error || "Suppression refusée."}${extra}`
        );
      }

      setMessage(
        `Compte supprimé : ${
          body.deletedEmail ||
          target.email ||
          target.id
        }`
      );

      setTarget(null);
      setConfirmation("");

      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression impossible."
      );
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
          <ArrowLeft size={17} />
          Centre Admin
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#17131f,#35165e_52%,#111827)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <Crown size={15} />
            Étape 11.4
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
            Nettoyage sécurisé des comptes
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Les comptes protégés ne peuvent jamais être
            supprimés depuis cette page. Pour un compte
            « À examiner », KLYX revérifie toutes les
            protections connues juste avant la suppression.
          </p>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-zinc-950 disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={18} />
            )}
            Actualiser
          </button>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600">
            {message}
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
                label="Supprimables à confirmer"
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
                    Suppression définitive
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Supprime uniquement les anciens comptes
                    que tu reconnais et que tu n’utilises plus.
                    Si Supabase détecte encore une contrainte,
                    la suppression sera refusée au lieu de
                    forcer la suppression de données liées.
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
                          {user.email ||
                            "Utilisateur sans e-mail"}
                        </h2>

                        {user.protected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-600">
                            <LockKeyhole size={12} />
                            PROTÉGÉ
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-600">
                            SUPPRIMABLE
                          </span>
                        )}
                      </div>

                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                        {user.id}
                      </p>

                      {user.protectionReasons.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {user.protectionReasons.map(
                            (reason) => (
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
                            )
                          )}
                        </div>
                      )}

                      {user.ownedProfiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                            Profils possédés
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user.ownedProfiles.map(
                              (profile) => (
                                <span
                                  key={profile.id}
                                  className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-bold"
                                >
                                  {profile.accountType ??
                                    "profil"}{" "}
                                  ·{" "}
                                  {profile.name ||
                                    profile.id}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={user.protected}
                      onClick={() =>
                        openDelete(user)
                      }
                      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black ${
                        user.protected
                          ? "cursor-not-allowed border border-border opacity-40"
                          : "bg-rose-600 text-white transition hover:bg-rose-700"
                      }`}
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

      {target && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4">
          <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">
                  Suppression définitive
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Supprimer ce compte Auth ?
                </h2>
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
              Compte :
              <strong className="ml-1 text-foreground">
                {target.email || target.id}
              </strong>
            </p>

            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Pour confirmer, écris exactement :
            </p>

            <code className="mt-2 block break-all rounded-xl bg-muted p-3 text-xs font-bold">
              SUPPRIMER {target.id}
            </code>

            <input
              value={confirmation}
              onChange={(event) =>
                setConfirmation(
                  event.target.value
                )
              }
              placeholder="Confirmation"
              className="mt-4 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-rose-500"
            />

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="h-11 rounded-xl border border-border px-5 text-sm font-black"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() =>
                  void deleteAccount()
                }
                disabled={
                  deleting ||
                  confirmation !==
                    `SUPPRIMER ${target.id}`
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-black text-white disabled:opacity-40"
              >
                {deleting ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={16} />
                )}
                Supprimer définitivement
              </button>
            </div>
          </section>
        </div>
      )}
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
      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileWarning,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type DocumentRow = {
  id: string;
  document_type: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  status: string;
};

type Check = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};

type VerificationRow = {
  id: string;
  profile_id: string;
  status: string;
  trust_level: string;
  submitted_at: string | null;
  review_note: string | null;
  documents: DocumentRow[];
  precheck: {
    passed: boolean;
    score: number;
    checks: Check[];
    recommendations: string[];
  };
};

const ACTIONS = [
  {
    value: "under_review",
    label: "Mettre en analyse",
  },
  {
    value: "approved",
    label: "Approuver",
  },
  {
    value: "changes_required",
    label: "Demander des corrections",
  },
  {
    value: "rejected",
    label: "Refuser",
  },
  {
    value: "reopened",
    label: "Rouvrir",
  },
] as const;

export default function AdminVerificationsPage() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(
    {}
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/admin/verifications",
        {
          cache: "no-store",
        }
      );

      const body = (await response.json()) as {
        verifications?: VerificationRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      setRows(body.verifications ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les dossiers."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openDocument(documentId: string) {
    try {
      const response = await fetch(
        "/api/admin/verifications/document",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documentId }),
        }
      );

      const body = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !body.url) {
        throw new Error(
          body.error || "Ouverture impossible."
        );
      }

      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ouverture impossible."
      );
    }
  }

  async function decide(
    verificationId: string,
    action: string
  ) {
    setBusyId(verificationId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        "/api/admin/verifications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationId,
            action,
            note: notes[verificationId] ?? "",
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Décision impossible."
        );
      }

      setSuccessMessage(
        body.message || "Décision enregistrée."
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Décision impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#111827,#312e81)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            Administration KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Vérifications prestataires
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            La pré-analyse vérifie uniquement les éléments
            techniques. Elle ne garantit jamais l’authenticité
            d’une identité.
          </p>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
          >
            <RefreshCw size={17} />
            Actualiser
          </button>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle
              className="animate-spin text-indigo-600"
              size={38}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="klyx-card mt-8 p-8 text-center">
            <BadgeCheck
              className="mx-auto text-emerald-500"
              size={42}
            />
            <h2 className="mt-4 text-xl font-black">
              Aucun dossier soumis
            </h2>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {rows.map((row) => (
              <article
                key={row.id}
                className="klyx-card p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="klyx-eyebrow">
                      Profil {row.profile_id.slice(0, 8)}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      Dossier {row.status}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Soumis :{" "}
                      {row.submitted_at
                        ? new Date(
                            row.submitted_at
                          ).toLocaleString("fr-BE")
                        : "Non renseigné"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-4 text-center">
                    <p className="text-3xl font-black">
                      {row.precheck.score}/100
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-wide">
                      Pré-analyse technique
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {row.precheck.checks.map((check) => (
                    <div
                      key={check.code}
                      className="flex gap-3 rounded-2xl border border-border p-4"
                    >
                      {check.passed ? (
                        <CheckCircle2
                          className="shrink-0 text-emerald-500"
                          size={20}
                        />
                      ) : (
                        <XCircle
                          className="shrink-0 text-rose-500"
                          size={20}
                        />
                      )}
                      <div>
                        <p className="font-black">
                          {check.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="font-black">Documents privés</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {row.documents.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() =>
                          void openDocument(document.id)
                        }
                        className="flex items-center justify-between gap-4 rounded-2xl border border-border p-4 text-left transition hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black">
                            {document.original_name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.document_type} ·{" "}
                            {Math.ceil(
                              document.size_bytes / 1024
                            )}{" "}
                            Ko
                          </p>
                        </div>
                        <Eye
                          className="shrink-0"
                          size={18}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mt-6 block">
                  <span className="mb-2 block text-sm font-black">
                    Note de décision
                  </span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={notes[row.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                    className="klyx-input resize-none"
                    placeholder="Explique la décision, surtout pour une correction ou un refus."
                  />
                </label>

                <div className="mt-5 flex flex-wrap gap-3">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() =>
                        void decide(row.id, action.value)
                      }
                      className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50 ${
                        action.value === "approved"
                          ? "bg-emerald-600 text-white"
                          : action.value === "rejected"
                            ? "bg-rose-600 text-white"
                            : "border border-border bg-background"
                      }`}
                    >
                      {action.value === "approved" && (
                        <CheckCircle2 size={17} />
                      )}
                      {action.value === "rejected" && (
                        <FileWarning size={17} />
                      )}
                      {action.value === "reopened" && (
                        <RotateCcw size={17} />
                      )}
                      {action.label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

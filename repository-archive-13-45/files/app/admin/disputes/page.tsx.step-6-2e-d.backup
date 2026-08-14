"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type ProfileSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  account_type: string;
};

type BookingSummary = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
};

type Dispute = {
  id: string;
  booking_id: string;
  reason: string;
  description: string;
  status: string;
  priority: string;
  decision_code: string | null;
  decision_note: string | null;
  created_at: string;
  booking: BookingSummary | null;
  openedByProfile: ProfileSummary | null;
  againstProfile: ProfileSummary | null;
};

const REASONS: Record<string, string> = {
  provider_absent: "Prestataire absent",
  client_absent: "Client absent",
  major_delay: "Retard important",
  unfinished_work: "Mission non terminée",
  unsatisfactory_work: "Travail insatisfaisant",
  unsafe_behavior: "Comportement dangereux",
  payment_problem: "Problème de paiement",
  other: "Autre problème",
};

const STATUSES = [
  ["open", "Ouvert"],
  ["under_review", "En analyse"],
  ["waiting_user", "Informations attendues"],
  ["resolved", "Résolu"],
  ["closed", "Fermé"],
] as const;

const DECISIONS = [
  ["", "Aucune décision"],
  ["no_action", "Aucune action"],
  ["warning_recorded", "Avertissement enregistré"],
  [
    "refund_review_required",
    "Remboursement à examiner séparément",
  ],
  [
    "provider_compensation_review",
    "Indemnisation prestataire à examiner",
  ],
  [
    "more_information_required",
    "Informations complémentaires nécessaires",
  ],
  ["safety_escalation", "Escalade sécurité"],
] as const;

function displayName(profile: ProfileSummary | null): string {
  if (!profile) return "Profil inconnu";

  return (
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`.trim() || "Profil KLYX"
  );
}

export default function AdminDisputesPage() {
  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("active");
  const [forms, setForms] = useState<
    Record<
      string,
      {
        status: string;
        decisionCode: string;
        note: string;
      }
    >
  >({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/admin/disputes",
        {
          cache: "no-store",
        }
      );

      const body = (await response.json()) as {
        disputes?: Dispute[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Chargement impossible."
        );
      }

      const disputes = body.disputes ?? [];
      setRows(disputes);
      setForms(
        Object.fromEntries(
          disputes.map((dispute) => [
            dispute.id,
            {
              status: dispute.status,
              decisionCode:
                dispute.decision_code ?? "",
              note: dispute.decision_note ?? "",
            },
          ])
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger les litiges."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !["resolved", "closed"].includes(row.status)
          : row.status === statusFilter);

      if (!matchesStatus) return false;
      if (!normalized) return true;

      return [
        row.id,
        row.booking_id,
        REASONS[row.reason] ?? row.reason,
        row.description,
        displayName(row.openedByProfile),
        displayName(row.againstProfile),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, rows, statusFilter]);

  async function save(disputeId: string) {
    const form = forms[disputeId];

    if (!form) return;

    setBusyId(disputeId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        "/api/admin/disputes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            disputeId,
            status: form.status,
            decisionCode: form.decisionCode,
            note: form.note,
          }),
        }
      );

      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "Mise à jour impossible."
        );
      }

      setSuccessMessage(
        body.message || "Dossier mis à jour."
      );
      await load();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Mise à jour impossible."
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#111827,#4c1d3f)] p-8 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]">
            <ShieldCheck size={15} />
            Administration KLYX
          </div>

          <h1 className="mt-5 text-3xl font-black sm:text-5xl">
            Administration des litiges
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
            Analyse les faits, demande des informations et
            conserve une décision motivée. Les remboursements
            restent traités dans leur système sécurisé séparé.
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

        <section className="klyx-card mt-6 grid gap-4 p-5 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              className="klyx-input pl-11"
              placeholder="Rechercher un profil, motif ou dossier"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="klyx-input"
          >
            <option value="active">
              Dossiers actifs
            </option>
            <option value="all">Tous les dossiers</option>
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
              className="animate-spin text-violet-600"
              size={38}
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="klyx-card mt-8 p-8 text-center">
            <CheckCircle2
              className="mx-auto text-emerald-500"
              size={42}
            />
            <h2 className="mt-4 text-xl font-black">
              Aucun dossier correspondant
            </h2>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {filteredRows.map((row) => {
              const form = forms[row.id] ?? {
                status: row.status,
                decisionCode:
                  row.decision_code ?? "",
                note: row.decision_note ?? "",
              };

              return (
                <article
                  key={row.id}
                  className="klyx-card p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                        <AlertTriangle size={22} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black">
                            {REASONS[row.reason] ??
                              row.reason}
                          </h2>
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                            {row.priority}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Ouvert par{" "}
                          <strong>
                            {displayName(
                              row.openedByProfile
                            )}
                          </strong>{" "}
                          contre{" "}
                          <strong>
                            {displayName(
                              row.againstProfile
                            )}
                          </strong>
                        </p>

                        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                          {row.description}
                        </p>

                        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 size={14} />
                          {new Date(
                            row.created_at
                          ).toLocaleString("fr-BE")}
                        </p>
                      </div>
                    </div>

                    {row.booking && (
                      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                        <p className="font-black">
                          Réservation
                        </p>
                        <p className="mt-2">
                          {row.booking.booking_date} ·{" "}
                          {row.booking.start_time.slice(
                            0,
                            5
                          )}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {row.booking.status} ·{" "}
                          {row.booking.payment_status ??
                            "paiement inconnu"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-black">
                        Statut du dossier
                      </span>
                      <select
                        value={form.status}
                        onChange={(event) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              status:
                                event.target.value,
                            },
                          }))
                        }
                        className="klyx-input"
                      >
                        {STATUSES.map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="mb-2 block text-sm font-black">
                        Décision
                      </span>
                      <select
                        value={form.decisionCode}
                        onChange={(event) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              decisionCode:
                                event.target.value,
                            },
                          }))
                        }
                        className="klyx-input"
                      >
                        {DECISIONS.map(
                          ([value, label]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-black">
                      Note visible dans le suivi
                    </span>
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={form.note}
                      onChange={(event) =>
                        setForms((current) => ({
                          ...current,
                          [row.id]: {
                            ...form,
                            note: event.target.value,
                          },
                        }))
                      }
                      className="klyx-input resize-none"
                      placeholder="Explique la demande d’information ou la décision."
                    />
                  </label>

                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void save(row.id)}
                    className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-violet-600 px-5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyId === row.id
                      ? "Enregistrement..."
                      : "Enregistrer la décision"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

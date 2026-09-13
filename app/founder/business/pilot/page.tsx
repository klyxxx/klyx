"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PilotStage =
  | "needs_offer"
  | "needs_acceptance"
  | "needs_booking"
  | "needs_payment"
  | "needs_completion"
  | "financial_review"
  | "completed_paid";

type PilotOperationsResponse = {
  pilotKey: string;
  generatedAt: string;
  excludedEnrollmentCount: number;
  status:
    | "running"
    | "economic_read_ready"
    | "request_cap_reached_without_proof";
  summary: {
    enrolledRequests: number;
    activeProviders: number;
    requestCapacityRemaining: number;
    providerCapacityRemaining: number;
    needsOffer: number;
    needsAcceptance: number;
    needsBooking: number;
    needsPayment: number;
    needsCompletion: number;
    financialReview: number;
    completedPaidMissions: number;
    economicReadReady: boolean;
    requestIntakeLocked: boolean;
    providerEnrollmentLocked: boolean;
    scopeExpansionLocked: true;
  };
  nextAction: {
    code: string;
    title: string;
    detail: string;
    requestId: string | null;
  };
  requestQueue: Array<{
    requestId: string;
    stage: PilotStage;
    offerCount: number;
    acceptedOfferId: string | null;
    bookingIds: string[];
    bookingStatuses: string[];
    successfulPaymentCents: number;
    successfulRefundCents: number;
    operatorAction: string;
  }>;
};

const STAGE_LABELS: Record<PilotStage, string> = {
  needs_offer: "PROPOSITION À OBTENIR",
  needs_acceptance: "DÉCISION CLIENT",
  needs_booking: "RÉSERVATION À CRÉER",
  needs_payment: "PAIEMENT À SÉCURISER",
  needs_completion: "MISSION À TERMINER",
  financial_review: "REVUE FINANCIÈRE",
  completed_paid: "TERMINÉE + PAYÉE",
};

const STATUS_LABELS: Record<PilotOperationsResponse["status"], string> = {
  running: "PILOTE EN COURS",
  economic_read_ready: "LECTURE ÉCONOMIQUE AUTORISÉE",
  request_cap_reached_without_proof: "ARRÊT : PLAFOND DEMANDES ATTEINT",
};

function euro(cents: number): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function FounderPilotOperationsPage() {
  const [data, setData] = useState<PilotOperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/founder/business-pilot/operations", {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as
        | PilotOperationsResponse
        | { error?: string };
      if (!response.ok || !("summary" in body) || !("requestQueue" in body)) {
        throw new Error(
          "error" in body && body.error
            ? body.error
            : "Impossible de charger le pilote réel."
        );
      }
      setData(body);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger le pilote réel."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/founder"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-black"
            >
              ← Founder
            </Link>
            <Link
              href="/founder/business"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-black"
            >
              Valeur économique
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50"
          >
            Actualiser
          </button>
        </div>

        <header className="mt-5 rounded-[2rem] bg-black p-7 text-white sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">
            Pilote réel · Anneessens
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Montage de meubles, une action réelle à la fois
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">
            Cette console ne crée aucune preuve. Elle lit uniquement les demandes, offres,
            réservations et paiements canoniques KLYX, puis indique le prochain blocage à
            résoudre sans dépasser 5 prestataires ni 20 demandes.
          </p>
        </header>

        {loading && (
          <div className="mt-6 rounded-3xl border border-border bg-card p-7 text-sm text-muted-foreground">
            Lecture du pilote réel…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                    Prochaine action opérateur
                  </p>
                  <h2 className="mt-2 text-2xl font-black">{data.nextAction.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {data.nextAction.detail}
                  </p>
                  {data.nextAction.requestId && (
                    <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                      Demande : {data.nextAction.requestId}
                    </p>
                  )}
                </div>
                <span className="rounded-full border border-border px-3 py-1.5 text-xs font-black">
                  {STATUS_LABELS[data.status]}
                </span>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Demandes réelles"
                value={`${data.summary.enrolledRequests}/20`}
                detail={`${data.summary.requestCapacityRemaining} place(s) restante(s)`}
              />
              <Metric
                label="Prestataires vérifiés"
                value={`${data.summary.activeProviders}/5`}
                detail={`${data.summary.providerCapacityRemaining} place(s) restante(s)`}
              />
              <Metric
                label="Terminées + payées"
                value={`${data.summary.completedPaidMissions}/10`}
                detail={
                  data.summary.economicReadReady
                    ? "Seuil minimal atteint"
                    : "Pas encore de conclusion économique forte"
                }
              />
              <Metric
                label="Revue financière"
                value={String(data.summary.financialReview)}
                detail="Remboursements complets à résoudre avant preuve"
              />
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <Gate
                label="Nouvelles demandes"
                locked={data.summary.requestIntakeLocked}
                openText="Ouvert dans la limite du pilote"
                lockedText="Verrouillé à 20 demandes"
              />
              <Gate
                label="Nouveaux prestataires"
                locked={data.summary.providerEnrollmentLocked}
                openText="Ouvert dans la limite du pilote"
                lockedText="Verrouillé à 5 prestataires"
              />
              <Gate
                label="Deuxième zone / catégorie"
                locked={data.summary.scopeExpansionLocked}
                openText="—"
                lockedText="Toujours verrouillé pendant le pilote"
              />
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
              <h2 className="text-xl font-black">File d'exécution</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Priorité : anomalie financière → paiement → exécution → réservation → décision → proposition.
              </p>

              {data.requestQueue.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Aucune demande réelle enrôlée. Le prochain progrès doit venir d'une vraie demande,
                  pas d'une fixture ou d'un compte de démonstration.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {data.requestQueue.map((row) => (
                    <article
                      key={row.requestId}
                      className="rounded-2xl border border-border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs text-muted-foreground">
                            {row.requestId}
                          </p>
                          <p className="mt-2 text-sm font-black">
                            {STAGE_LABELS[row.stage]}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {row.operatorAction}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{row.offerCount} proposition(s)</div>
                          <div className="mt-1">
                            {row.bookingIds.length} réservation(s)
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                        <Data label="Paiement observé" value={euro(row.successfulPaymentCents)} />
                        <Data label="Remboursement observé" value={euro(row.successfulRefundCents)} />
                        <Data
                          label="Statut réservation"
                          value={row.bookingStatuses.join(", ") || "—"}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
              <strong className="text-foreground">Règle d'exploitation :</strong> atteindre le
              plafond n'est pas une réussite en soi. Si 20 demandes sont consommées sans 10 missions
              terminées et payées, KLYX arrête l'acquisition de ce pilote et analyse les causes au lieu
              d'augmenter artificiellement le volume. Une preuve économique atteinte autorise une
              analyse, pas une expansion automatique.
              {data.excludedEnrollmentCount > 0 && (
                <span className="mt-3 block font-bold text-amber-700">
                  {data.excludedEnrollmentCount} enrôlement(s) ont été exclus par la revalidation du
                  service ou de la ville.
                </span>
              )}
              <span className="mt-3 block text-xs">
                Dernière lecture : {new Date(data.generatedAt).toLocaleString("fr-BE")}
              </span>
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
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Gate({
  label,
  locked,
  openText,
  lockedText,
}: {
  label: string;
  locked: boolean;
  openText: string;
  lockedText: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-black">{locked ? "VERROUILLÉ" : "OUVERT"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {locked ? lockedText : openText}
      </p>
    </article>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <span className="block text-muted-foreground">{label}</span>
      <strong className="mt-1 block break-all text-foreground">{value}</strong>
    </div>
  );
}

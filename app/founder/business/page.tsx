"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const WINDOWS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOWS)[number];

type CategoryMetric = {
  categorySlug: string;
  categoryName: string;
  funnel: {
    demands: number;
    demandsWithProposal: number;
    proposals: number;
    bookings: number;
    completedMissions: number;
    demandToProposalRate: number | null;
    proposalToBookingRate: number | null;
    bookingToCompletedRate: number | null;
  };
  repeat: {
    clientsWithCompletedMission: number;
    repeatClients: number;
    repeatRate: number | null;
  };
  finance: {
    currency: string | null;
    mixedCurrency: boolean;
    grossMissionValueCents: number | null;
    klyxCommissionCents: number | null;
    refundsCents: number | null;
    retainedCommissionAfterRefundsCents: number | null;
    stripeFeesCents: number | null;
    supportCostCents: number | null;
    fraudDisputeCostCents: number | null;
    acquisitionCostCents: number | null;
    estimatedContributionMarginCents: number | null;
    estimatedNetMarginCents: number | null;
  };
};

type MetricsResponse = {
  window: { days: number; startDate: string; endDate: string };
  categories: CategoryMetric[];
  tracking: Record<string, "unavailable" | "manual" | "automated">;
  unattributedCosts: Array<{
    costType: string;
    currency: string;
    amountCents: number;
  }>;
  pilot: {
    config: {
      key: string;
      status: string;
      city: string;
      zoneLabel: string;
      categoryName: string;
      serviceName: string;
      maxActiveProviders: number;
      maxRealRequests: number;
      minimumCompletedPaidMissionsForEconomicRead: number;
      syntheticTransactionsAllowed: boolean;
      paidAcquisitionEnabled: boolean;
    };
    enrolledRequests: number;
    verifiedRequests: number;
    rejectedEnrollmentCount: number;
    activeProviders: number;
    completedPaidMissions: number;
    economicReadReady: boolean;
    categoryMetrics: CategoryMetric | null;
    clientLoop: {
      needs: number;
      solutions: number;
      paidBookings: number;
      completedPaidMissions: number;
    };
    providerIncomeLoop: {
      verifiedAvailabilityAndIncomeGoals: number;
      proposalsSent: number;
      proposalsAccepted: number;
      missionsCompleted: number;
      providerSettlementRecorded: number;
      note: string;
    };
    integrity: {
      syntheticTransactionsAllowed: boolean;
      preciseAddressStored: boolean;
      paidAcquisitionEnabled: boolean;
    };
  };
};

type MutationState = {
  busy: boolean;
  message: string;
  error: boolean;
};

const EMPTY_MUTATION: MutationState = { busy: false, message: "", error: false };

function percent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} %`;
}

function money(cents: number | null, currency: string | null): string {
  if (cents === null || !currency) return "—";
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function integer(value: number): string {
  return new Intl.NumberFormat("fr-BE").format(value);
}

function trackingLabel(mode: string | undefined): string {
  if (mode === "automated") return "Automatique";
  if (mode === "manual") return "Manuel réel";
  return "Indisponible";
}

export default function FounderBusinessPage() {
  const [days, setDays] = useState<WindowDays>(30);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mutation, setMutation] = useState<MutationState>(EMPTY_MUTATION);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/founder/business-metrics?days=${days}`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as Partial<MetricsResponse> & {
        error?: string;
      };
      if (!response.ok || !body.categories || !body.pilot || !body.tracking) {
        throw new Error(body.error || "Impossible de charger les métriques.");
      }
      setData(body as MetricsResponse);
    } catch (error) {
      setData(null);
      setLoadError(error instanceof Error ? error.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postJson(path: string, body: Record<string, unknown>) {
    setMutation({ busy: true, message: "", error: false });
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Opération refusée.");
      }
      setMutation({ busy: false, message: "Enregistré avec données réelles.", error: false });
      await load();
    } catch (error) {
      setMutation({
        busy: false,
        message: error instanceof Error ? error.message : "Opération impossible.",
        error: true,
      });
    }
  }

  const totalGmv = useMemo(() => {
    if (!data) return null;
    const currencies = new Set(
      data.categories
        .map((category) => category.finance.currency)
        .filter((value): value is string => Boolean(value))
    );
    if (currencies.size !== 1) return null;
    return {
      currency: [...currencies][0],
      cents: data.categories.reduce(
        (sum, category) => sum + (category.finance.grossMissionValueCents ?? 0),
        0
      ),
    };
  }, [data]);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/founder"
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-bold"
          >
            ← Founder
          </Link>
          <div className="flex gap-2" aria-label="Fenêtre d'analyse">
            {WINDOWS.map((windowDays) => (
              <button
                key={windowDays}
                type="button"
                onClick={() => setDays(windowDays)}
                aria-pressed={days === windowDays}
                className={`min-h-11 rounded-xl px-4 text-sm font-bold ${
                  days === windowDays
                    ? "bg-blue-600 text-white"
                    : "border border-border bg-card"
                }`}
              >
                {windowDays} j
              </button>
            ))}
          </div>
        </div>

        <header className="mt-5 rounded-[2rem] border border-white/10 bg-black p-7 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            Preuve économique KLYX
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Valeur réelle, pas métriques décoratives
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/65">
            Cohortes transactionnelles, coûts constatés et marges fail-closed. Une donnée
            indisponible reste inconnue : elle n'est jamais transformée en zéro.
          </p>
        </header>

        {loading && (
          <div className="mt-6 rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Chargement des données métier canoniques…
          </div>
        )}

        {loadError && (
          <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Valeur brute"
                value={totalGmv ? money(totalGmv.cents, totalGmv.currency) : "Par devise uniquement"}
                detail="Paiements réussis du ledger"
              />
              <SummaryCard
                label="Catégories actives"
                value={integer(data.categories.length)}
                detail="Seulement celles avec signal réel"
              />
              <SummaryCard
                label="Pilote terminé + payé"
                value={`${data.pilot.completedPaidMissions}/${data.pilot.config.minimumCompletedPaidMissionsForEconomicRead}`}
                detail={data.pilot.economicReadReady ? "Lecture économique autorisée" : "Échantillon encore insuffisant"}
              />
              <SummaryCard
                label="Acquisition"
                value={trackingLabel(data.tracking.acquisition)}
                detail="La marge nette reste — tant que CAC est indisponible"
              />
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                    Pilote local préparé
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {data.pilot.config.zoneLabel} · {data.pilot.config.serviceName}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {data.pilot.config.city} · {data.pilot.config.categoryName} · maximum {data.pilot.config.maxActiveProviders} prestataires / {data.pilot.config.maxRealRequests} demandes réelles.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  data.pilot.economicReadReady
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700"
                }`}>
                  {data.pilot.economicReadReady ? "PREUVE MINIMALE ATTEINTE" : "PILOTE NON CONCLUANT POUR L'INSTANT"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <LoopCard
                  title="Besoin → solution → paiement → mission réussie"
                  values={[
                    ["Besoins vérifiés", data.pilot.clientLoop.needs],
                    ["Besoins avec solution", data.pilot.clientLoop.solutions],
                    ["Réservations payées", data.pilot.clientLoop.paidBookings],
                    ["Missions terminées + payées", data.pilot.clientLoop.completedPaidMissions],
                  ]}
                />
                <LoopCard
                  title="Disponibilité + revenu → proposition → acceptation → mission → paiement"
                  values={[
                    ["Départs vérifiés", data.pilot.providerIncomeLoop.verifiedAvailabilityAndIncomeGoals],
                    ["Propositions envoyées", data.pilot.providerIncomeLoop.proposalsSent],
                    ["Propositions acceptées", data.pilot.providerIncomeLoop.proposalsAccepted],
                    ["Missions terminées", data.pilot.providerIncomeLoop.missionsCompleted],
                    ["Montant prestataire enregistré", data.pilot.providerIncomeLoop.providerSettlementRecorded],
                  ]}
                />
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <Integrity label="Transactions synthétiques" value={data.pilot.integrity.syntheticTransactionsAllowed ? "Autorisées" : "INTERDITES"} />
                <Integrity label="Adresse précise stockée" value={data.pilot.integrity.preciseAddressStored ? "Oui" : "Non"} />
                <Integrity label="Acquisition payante" value={data.pilot.integrity.paidAcquisitionEnabled ? "Active" : "Désactivée"} />
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card">
              <div className="border-b border-border p-5 sm:p-7">
                <h2 className="text-2xl font-black">Économie par catégorie</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les taux sont des cohortes réelles. Les montants mélangés entre devises ne sont jamais agrégés.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1500px] w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>Catégorie</Th>
                      <Th>Valeur brute</Th>
                      <Th>Commission</Th>
                      <Th>Frais Stripe</Th>
                      <Th>Remboursements</Th>
                      <Th>Support</Th>
                      <Th>Fraude/litiges</Th>
                      <Th>Acquisition</Th>
                      <Th>Marge contributive</Th>
                      <Th>Marge nette estimée</Th>
                      <Th>Demande → proposition</Th>
                      <Th>Proposition → réservation</Th>
                      <Th>Réservation → terminée</Th>
                      <Th>Repeat rate</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.categories.length === 0 && (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-muted-foreground">
                          Aucune activité réelle sur cette fenêtre.
                        </td>
                      </tr>
                    )}
                    {data.categories.map((category) => (
                      <tr key={category.categorySlug} className="align-top">
                        <Td>
                          <strong className="text-sm">{category.categoryName}</strong>
                          <div className="mt-1 text-muted-foreground">
                            {category.funnel.demands} demandes · {category.funnel.proposals} propositions
                          </div>
                        </Td>
                        <Td>{money(category.finance.grossMissionValueCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.klyxCommissionCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.stripeFeesCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.refundsCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.supportCostCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.fraudDisputeCostCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.acquisitionCostCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.estimatedContributionMarginCents, category.finance.currency)}</Td>
                        <Td>{money(category.finance.estimatedNetMarginCents, category.finance.currency)}</Td>
                        <Td>{percent(category.funnel.demandToProposalRate)}</Td>
                        <Td>{percent(category.funnel.proposalToBookingRate)}</Td>
                        <Td>{percent(category.funnel.bookingToCompletedRate)}</Td>
                        <Td>{percent(category.repeat.repeatRate)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 grid gap-5 xl:grid-cols-2">
              <ToolCard title="Enregistrer un coût réel">
                <CostForm disabled={mutation.busy} onSubmit={(body) => postJson("/api/founder/business-costs", body)} />
              </ToolCard>
              <ToolCard title="Synchroniser les frais Stripe réels">
                <StripeSyncForm disabled={mutation.busy} onSubmit={(bookingId) => postJson("/api/founder/business-costs/stripe-sync", { bookingId })} />
              </ToolCard>
              <ToolCard title="Ajouter une demande réelle au pilote">
                <PilotRequestForm disabled={mutation.busy} onSubmit={(body) => postJson("/api/founder/business-pilot", body)} />
              </ToolCard>
              <ToolCard title="Prouver un départ objectif revenu + disponibilité">
                <IncomeAttemptForm disabled={mutation.busy} onSubmit={(body) => postJson("/api/founder/business-pilot", body)} />
              </ToolCard>
            </section>

            {mutation.message && (
              <div className={`mt-5 rounded-2xl p-4 text-sm ${mutation.error ? "bg-rose-500/10 text-rose-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                {mutation.message}
              </div>
            )}

            <section className="mt-6 grid gap-4 md:grid-cols-4">
              {Object.entries(data.tracking).map(([type, mode]) => (
                <div key={type} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{type}</p>
                  <p className="mt-2 font-black">{trackingLabel(mode)}</p>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
              <h2 className="text-lg font-black text-foreground">Règles de lecture</h2>
              <p className="mt-2">
                La marge contributive = commission conservée après remboursements − frais Stripe − support − fraude/litiges. La marge nette ajoute le coût d'acquisition ; tant que ce coût est indisponible, KLYX affiche « — » plutôt qu'un faux bénéfice.
              </p>
              <p className="mt-2">
                Le repeat rate est descriptif sur la fenêtre sélectionnée. Aucun élargissement du pilote ne doit être décidé à partir de recherches, inscriptions ou volume de demandes seuls.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function LoopCard({ title, values }: { title: string; values: Array<[string, number]> }) {
  return (
    <article className="rounded-2xl border border-border bg-background p-5">
      <h3 className="font-black">{title}</h3>
      <div className="mt-4 space-y-2">
        {values.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <strong>{integer(value)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function Integrity({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <strong className="ml-2">{value}</strong>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-black">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-4">{children}</td>;
}

function ToolCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" />;
}

function Submit({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={disabled} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">
      {children}
    </button>
  );
}

function CostForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [costType, setCostType] = useState("support");
  const [amount, setAmount] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [marketRequestId, setMarketRequestId] = useState("");
  const [note, setNote] = useState("");

  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const euros = Number(amount);
      if (!Number.isFinite(euros) || euros < 0) return;
      onSubmit({
        costType,
        amountCents: Math.round(euros * 100),
        currency: "EUR",
        bookingId: bookingId || undefined,
        marketRequestId: marketRequestId || undefined,
        note: note || undefined,
        source: costType === "fraud_dispute" ? "fraud" : costType === "acquisition" ? "acquisition" : "support",
      });
    }}>
      <select value={costType} onChange={(event) => setCostType(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
        <option value="support">Support</option>
        <option value="fraud_dispute">Fraude / litige</option>
        <option value="acquisition">Acquisition réelle</option>
      </select>
      <Input required inputMode="decimal" placeholder="Montant réel en €" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Input placeholder="Booking ID (ou demande ci-dessous)" value={bookingId} onChange={(event) => setBookingId(event.target.value)} />
      <Input placeholder="Market request ID" value={marketRequestId} onChange={(event) => setMarketRequestId(event.target.value)} />
      <Input placeholder="Note / justification" value={note} onChange={(event) => setNote(event.target.value)} />
      <Submit disabled={disabled}>Enregistrer le coût constaté</Submit>
    </form>
  );
}

function StripeSyncForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (bookingId: string) => void }) {
  const [bookingId, setBookingId] = useState("");
  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (bookingId.trim()) onSubmit(bookingId.trim());
    }}>
      <Input required placeholder="Booking ID payé" value={bookingId} onChange={(event) => setBookingId(event.target.value)} />
      <p className="text-xs leading-5 text-muted-foreground">
        Lit le PaymentIntent et sa Balance Transaction. Aucun pourcentage Stripe n'est estimé.
      </p>
      <Submit disabled={disabled}>Lire les frais Stripe</Submit>
    </form>
  );
}

function PilotRequestForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [requestId, setRequestId] = useState("");
  const [zone, setZone] = useState(false);
  const [service, setService] = useState(false);
  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      onSubmit({ action: "enroll_request", marketRequestId: requestId.trim(), confirmedZone: zone, confirmedService: service });
    }}>
      <Input required placeholder="Market request ID réel" value={requestId} onChange={(event) => setRequestId(event.target.value)} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={zone} onChange={(event) => setZone(event.target.checked)} /> J'ai vérifié que la mission est bien dans la zone Anneessens.</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={service} onChange={(event) => setService(event.target.checked)} /> J'ai vérifié qu'il s'agit de Montage de meubles.</label>
      <Submit disabled={disabled || !zone || !service}>Enrôler la demande réelle</Submit>
    </form>
  );
}

function IncomeAttemptForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [offerId, setOfferId] = useState("");
  const [goal, setGoal] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [availability, setAvailability] = useState(false);
  const [incomeGoal, setIncomeGoal] = useState(false);

  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const euros = Number(goal);
      if (!Number.isFinite(euros) || euros <= 0) return;
      onSubmit({
        action: "enroll_income_attempt",
        marketOfferId: offerId.trim(),
        incomeGoalCents: Math.round(euros * 100),
        currency: "EUR",
        availabilityDate: date || undefined,
        availabilityStart: start || undefined,
        availabilityEnd: end || undefined,
        confirmedAvailability: availability,
        confirmedIncomeGoal: incomeGoal,
      });
    }}>
      <Input required placeholder="Market offer ID réel" value={offerId} onChange={(event) => setOfferId(event.target.value)} />
      <Input required inputMode="decimal" placeholder="Objectif de revenu en €" value={goal} onChange={(event) => setGoal(event.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
        <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={availability} onChange={(event) => setAvailability(event.target.checked)} /> Disponibilité réellement déclarée et vérifiée.</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={incomeGoal} onChange={(event) => setIncomeGoal(event.target.checked)} /> Objectif de revenu réellement exprimé.</label>
      <Submit disabled={disabled || !availability || !incomeGoal}>Relier l'objectif à cette vraie offre</Submit>
    </form>
  );
}

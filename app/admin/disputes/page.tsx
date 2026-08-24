"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import KlyxSelect from "@/app/components/KlyxSelect";
import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  getKlyxAdminDisputesIntlLocale,
  translateKlyxAdminBookingStatus,
  translateKlyxAdminDisputeDecision,
  translateKlyxAdminDisputes,
  translateKlyxAdminPaymentStatus,
  translateKlyxAdminPriority,
  type KlyxAdminDisputesMessageKey,
} from "@/lib/klyx-admin-disputes-i18n";
import {
  translateKlyxTrustReason,
  translateKlyxTrustStatus,
} from "@/lib/klyx-trust-page-i18n";

// KLYX_ADMIN_DISPUTES_I18N

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

const STATUS_VALUES = [
  "open",
  "under_review",
  "waiting_user",
  "resolved",
  "closed",
] as const;

const DECISION_VALUES = [
  "",
  "no_action",
  "warning_recorded",
  "refund_review_required",
  "provider_compensation_review",
  "more_information_required",
  "safety_escalation",
] as const;

export default function AdminDisputesPage() {
  const { locale } = useKlyxLocale();
  const t = useCallback(
    (key: KlyxAdminDisputesMessageKey) =>
      translateKlyxAdminDisputes(locale, key),
    [locale]
  );

  const displayName = useCallback(
    (profile: ProfileSummary | null): string => {
      if (!profile) return t("unknownProfile");

      return (
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
        t("klyxProfile")
      );
    },
    [t]
  );

  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
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
  const [successMessage, setSuccessMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/disputes", {
        cache: "no-store",
      });

      const body = (await response.json()) as {
        disputes?: Dispute[];
      };

      if (!response.ok) {
        throw new Error("KLYX_ADMIN_DISPUTES_LOAD_FAILED");
      }

      const disputes = body.disputes ?? [];
      setRows(disputes);
      setForms(
        Object.fromEntries(
          disputes.map((dispute) => [
            dispute.id,
            {
              status: dispute.status,
              decisionCode: dispute.decision_code ?? "",
              note: dispute.decision_note ?? "",
            },
          ])
        )
      );
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

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
        translateKlyxTrustReason(locale, row.reason),
        row.description,
        displayName(row.openedByProfile),
        displayName(row.againstProfile),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [displayName, locale, query, rows, statusFilter]);

  async function save(disputeId: string) {
    const form = forms[disputeId];

    if (!form) return;

    setBusyId(disputeId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/disputes", {
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
      });

      await response.json();

      if (!response.ok) {
        throw new Error("KLYX_ADMIN_DISPUTES_UPDATE_FAILED");
      }

      setSuccessMessage(t("updateSuccess"));
      await load();
    } catch {
      setErrorMessage(t("updateError"));
    } finally {
      setBusyId("");
    }
  }

  const statusOptions = STATUS_VALUES.map((value) => ({
    value,
    label: translateKlyxTrustStatus(locale, value),
  }));

  const decisionOptions = DECISION_VALUES.map((value) => ({
    value,
    label: translateKlyxAdminDisputeDecision(locale, value),
  }));

  return (
    <main className="klyx-page">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#111827,#4c1d3f)] p-8 text-white">
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

          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950"
          >
            <RefreshCw size={17} />
            {t("refresh")}
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
              onChange={(event) => setQuery(event.target.value)}
              className="klyx-input pl-11"
              placeholder={t("searchPlaceholder")}
            />
          </label>

          <KlyxSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: t("activeCases") },
              { value: "all", label: t("allCases") },
              ...statusOptions,
            ]}
            ariaLabel={t("filterAria")}
          />
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
            <h2 className="mt-4 text-xl font-black">{t("emptyTitle")}</h2>
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {filteredRows.map((row) => {
              const form = forms[row.id] ?? {
                status: row.status,
                decisionCode: row.decision_code ?? "",
                note: row.decision_note ?? "",
              };

              return (
                <article key={row.id} className="klyx-card p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                        <AlertTriangle size={22} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-black">
                            {translateKlyxTrustReason(locale, row.reason)}
                          </h2>
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                            {translateKlyxAdminPriority(locale, row.priority)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {t("openedBy")} <strong>{displayName(row.openedByProfile)}</strong>{" "}
                          {t("against")} <strong>{displayName(row.againstProfile)}</strong>
                        </p>

                        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                          {row.description}
                        </p>

                        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 size={14} />
                          {new Date(row.created_at).toLocaleString(
                            getKlyxAdminDisputesIntlLocale(locale)
                          )}
                        </p>
                      </div>
                    </div>

                    {row.booking && (
                      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                        <p className="font-black">{t("booking")}</p>
                        <p className="mt-2">
                          {row.booking.booking_date} · {row.booking.start_time.slice(0, 5)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {translateKlyxAdminBookingStatus(locale, row.booking.status)} ·{" "}
                          {translateKlyxAdminPaymentStatus(locale, row.booking.payment_status)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-black">
                        {t("caseStatus")}
                      </span>
                      <KlyxSelect
                        value={form.status}
                        onChange={(value) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              status: value,
                            },
                          }))
                        }
                        options={statusOptions}
                        ariaLabel={t("caseStatus")}
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-sm font-black">
                        {t("decision")}
                      </span>
                      <KlyxSelect
                        value={form.decisionCode}
                        onChange={(value) =>
                          setForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...form,
                              decisionCode: value,
                            },
                          }))
                        }
                        options={decisionOptions}
                        ariaLabel={t("decision")}
                      />
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-black">
                      {t("noteLabel")}
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
                      placeholder={t("notePlaceholder")}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void save(row.id)}
                    className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-violet-600 px-5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyId === row.id ? t("saving") : t("saveDecision")}
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

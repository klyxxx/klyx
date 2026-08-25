// KLYX_PROVIDER_JOBS_UI_CURRENCY_PHASE_5C
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock3,
  Layers3,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useKlyxLocale } from "@/app/components/KlyxLocaleProvider";
import {
  formatKlyxProviderJobsCount,
  formatKlyxProviderJobsDate,
  formatKlyxProviderJobsDuration,
  formatKlyxProviderJobsMoney,
  translateKlyxProviderJobOfferStatus,
  translateKlyxProviderJobs,
  translateKlyxProviderJobsMatch,
  type KlyxProviderJobsMessageKey,
} from "@/lib/klyx-provider-jobs-i18n";
import { supabase } from "@/lib/supabase";

// KLYX_PROVIDER_MULTI_JOBS_UI_12_93

type MultiSlot = {
  id: string;
  position: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  budgetMax: number | null;
  durationMinutes: number | null;
};

type MarketRequest = {
  id: string;
  title: string;
  description: string;
  city: string;
  requested_date: string | null;
  requested_time: string | null;
  budget_max: number | null;
  country_code: string;
  currency: string;
  requestMode: "single" | "multi_slot";
  slotCount: number;
  budgetTotal: number | null;
  preferSingleProvider: boolean;
  totalDurationMinutes: number | null;
  slots: MultiSlot[];
  coverage: {
    count: number;
    total: number;
    fullCoverage: boolean;
    label: string;
  } | null;
  service: {
    name?: string | null;
    slug?: string;
  } | null;
  match: {
    score: number;
    reasons: string[];
    locationMatch?: boolean;
    availabilityMatch?: boolean;
    budgetMatch?: boolean | null;
  } | null;
  myOffer: {
    id: string;
    amount: number;
    message: string | null;
    status: string;
  } | null;
};

type ProviderJobsResponse = {
  requests?: MarketRequest[];
  count?: number;
  multiSlotAware?: boolean;
  fullCoverageOnly?: boolean;
  automaticExecutionAllowed?: boolean;
};

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Provider jobs session unavailable");
  }

  return session.access_token;
}

function timeLabel(value: string | null): string {
  return value ? value.slice(0, 5) : "--:--";
}

export default function ProviderJobsPage() {
  const { locale } = useKlyxLocale();
  const t = (key: KlyxProviderJobsMessageKey) =>
    translateKlyxProviderJobs(locale, key);

  const [requests, setRequests] = useState<MarketRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = useCallback(
    (value: number | null, currency: string) =>
      formatKlyxProviderJobsMoney(locale, value, currency),
    [locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const accessToken = await token();
      const response = await fetch("/api/provider/jobs", {
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      if (!response.ok) {
        throw new Error("Provider jobs unavailable");
      }

      const body = (await response.json()) as ProviderJobsResponse;
      const rows = body.requests ?? [];
      setRequests(rows);

      const nextAmounts: Record<string, string> = {};
      const nextMessages: Record<string, string> = {};

      for (const row of rows) {
        if (row.myOffer) {
          nextAmounts[row.id] = String(row.myOffer.amount);
          nextMessages[row.id] = row.myOffer.message ?? "";
        }
      }

      setAmounts(nextAmounts);
      setMessages(nextMessages);
    } catch {
      setErrorMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: requests.length,
      multi: requests.filter((item) => item.requestMode === "multi_slot").length,
      offered: requests.filter((item) => Boolean(item.myOffer)).length,
      pendingOffers: requests.filter((item) => item.myOffer?.status === "pending").length,
      acceptedOffers: requests.filter((item) => item.myOffer?.status === "accepted").length,
      rejectedOffers: requests.filter((item) => item.myOffer?.status === "rejected").length,
    }),
    [requests]
  );

  async function submitOffer(
    event: FormEvent<HTMLFormElement>,
    request: MarketRequest
  ) {
    event.preventDefault();
    setBusy(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const accessToken = await token();

      if (
        request.requestMode === "multi_slot" &&
        !request.coverage?.fullCoverage
      ) {
        setErrorMessage(t("coverageError"));
        return;
      }

      const amount = Number(amounts[request.id]);
      if (!Number.isFinite(amount) || amount <= 0) {
        setErrorMessage(t("amountError"));
        return;
      }

      const response = await fetch(
        "/api/market/requests/" + request.id + "/offers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
          },
          body: JSON.stringify({
            amount,
            message: messages[request.id] ?? "",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Provider offer unavailable");
      }

      await response.json();
      setSuccessMessage(
        request.requestMode === "multi_slot"
          ? t("multiOfferSent")
          : t("offerSent")
      );
      await load();
    } catch {
      setErrorMessage(t("offerError"));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
          {t("eyebrow")}
        </p>

        {/* KLYX_AI_FIRST_PROVIDER_JOBS_15_04 */}
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          {t("description")}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Stat label={t("missions")} value={String(counts.total)} />
          <Stat label={t("multiSlot")} value={String(counts.multi)} />
          <Stat label={t("offersSent")} value={String(counts.offered)} />
        </div>

        {/* KLYX_PROVIDER_OFFER_TRACKING_13_77 */}
        {!loading && counts.offered > 0 && (
          <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  {t("offerTracking")}
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {t("offerTrackingTitle")}
                </h2>
              </div>
              <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black">
                {formatKlyxProviderJobsCount(locale, counts.offered, "offer")}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <TrackingCard
                className="border-amber-500/20 bg-amber-500/5"
                labelClassName="text-amber-700 dark:text-amber-300"
                label={t("pending")}
                value={counts.pendingOffers}
                detail={t("pendingDetail")}
              />
              <TrackingCard
                className="border-emerald-500/20 bg-emerald-500/5"
                labelClassName="text-emerald-700 dark:text-emerald-300"
                label={t("accepted")}
                value={counts.acceptedOffers}
                detail={t("acceptedDetail")}
              />
              <TrackingCard
                className="border-rose-500/20 bg-rose-500/5"
                labelClassName="text-rose-700 dark:text-rose-300"
                label={t("rejected")}
                value={counts.rejectedOffers}
                detail={t("rejectedDetail")}
              />
            </div>

            <div className="mt-5 space-y-3">
              {requests
                .filter((request) => Boolean(request.myOffer))
                .map((request) => {
                  const status = request.myOffer?.status ?? "pending";
                  return (
                    <div
                      key={`offer-status-${request.id}`}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black">{request.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("offer")}: {money(request.myOffer?.amount ?? null, request.currency)}
                        </p>
                      </div>
                      <span
                        className={
                          "inline-flex shrink-0 rounded-full px-3 py-1.5 text-xs font-black " +
                          (status === "accepted"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : status === "rejected"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300")
                        }
                      >
                        {translateKlyxProviderJobOfferStatus(locale, status)}
                      </span>
                    </div>
                  );
                })}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              {t("offerNotBookingPayment")}
            </p>
          </section>
        )}

        {successMessage && (
          <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* KLYX_PROVIDER_OPPORTUNITY_FOCUS_13_76 */}
        {!loading && requests.length > 0 && (() => {
          const byMatch = [...requests].sort(
            (a, b) => Number(b.match?.score ?? 0) - Number(a.match?.score ?? 0)
          );
          const bestMatch = byMatch[0];
          const nextToAnswer = byMatch.find((request) => !request.myOffer) ?? null;
          const highestBudget =
            [...requests]
              .filter(
                (request) =>
                  request.budgetTotal !== null || request.budget_max !== null
              )
              .sort(
                (a, b) =>
                  Number(b.budgetTotal ?? b.budget_max ?? 0) -
                  Number(a.budgetTotal ?? a.budget_max ?? 0)
              )[0] ?? null;

          return (
            <section className="mt-6 overflow-hidden rounded-3xl border border-blue-500/20 bg-blue-500/5">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                      {t("priority")}
                    </p>
                    <h2 className="mt-2 text-xl font-black sm:text-2xl">
                      {t("priorityTitle")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("priorityDescription")}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black">
                    {formatKlyxProviderJobsCount(locale, counts.total, "mission")}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-violet-500/20 bg-background p-4">
                    <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                      <Sparkles size={17} />
                      <p className="text-xs font-black uppercase tracking-wide">
                        {t("bestMatch")}
                      </p>
                    </div>
                    <p className="mt-3 line-clamp-2 font-black">{bestMatch.title}</p>
                    <p className="mt-3 text-2xl font-black">
                      {bestMatch.match?.score ?? 0}%
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {translateKlyxProviderJobsMatch(
                        locale,
                        Number(bestMatch.match?.score ?? 0)
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-background p-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Banknote size={17} />
                      <p className="text-xs font-black uppercase tracking-wide">
                        {t("highestBudget")}
                      </p>
                    </div>
                    {highestBudget ? (
                      <>
                        <p className="mt-3 line-clamp-2 font-black">{highestBudget.title}</p>
                        <p className="mt-3 text-xl font-black">
                          {money(
                            highestBudget.budgetTotal ?? highestBudget.budget_max,
                            highestBudget.currency
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("clientBudgetDetail")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 font-black">{t("noBudget")}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("priceToPropose")}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-background p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Send size={17} />
                      <p className="text-xs font-black uppercase tracking-wide">
                        {t("nextAction")}
                      </p>
                    </div>
                    {nextToAnswer ? (
                      <>
                        <p className="mt-3 line-clamp-2 font-black">{nextToAnswer.title}</p>
                        <p className="mt-3 text-sm font-black text-blue-600 dark:text-blue-300">
                          {t("offerToPrepare")}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("offerToPrepareDetail")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 font-black">{t("allHandled")}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {t("allHandledDetail")}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-background/70 p-4 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  <p>{t("decisionAid")}</p>
                </div>
              </div>
            </section>
          );
        })()}

        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle className="animate-spin text-blue-600" size={36} />
          </div>
        ) : requests.length === 0 ? (
          <div className="klyx-card mt-7 p-8 text-center">
            <ShieldCheck className="mx-auto text-violet-600" size={42} />
            <h2 className="mt-4 text-xl font-black">{t("noCompatible")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {t("noCompatibleDetail")}
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-5">
            {requests.map((item) => (
              <article key={item.id} className="klyx-card p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                        {item.service?.name ?? t("fallbackService")}
                      </p>

                      {item.requestMode === "multi_slot" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-700 dark:text-violet-300">
                          <Layers3 size={13} />
                          {formatKlyxProviderJobsCount(locale, item.slotCount, "slot")}
                        </span>
                      )}

                      {item.coverage?.fullCoverage && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck size={13} />
                          {item.coverage.label} {t("available")}
                        </span>
                      )}

                      {item.match && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-700 dark:text-violet-300">
                          <Sparkles size={13} />
                          {item.match.score}% · {translateKlyxProviderJobsMatch(locale, item.match.score)}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 text-2xl font-black">{item.title}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin size={16} />
                      {item.city}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>

                    {item.match && item.match.reasons.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.match.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-bold"
                          >
                            <BadgeCheck size={13} />
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="min-w-48 rounded-2xl border border-border bg-background p-4 text-right">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                      {item.requestMode === "multi_slot" ? t("budgetTotal") : t("clientBudget")}
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {money(
                        item.requestMode === "multi_slot"
                          ? item.budgetTotal
                          : item.budget_max,
                        item.currency
                      )}
                    </p>
                    {item.requestMode === "multi_slot" &&
                      item.totalDurationMinutes !== null && (
                        <p className="mt-2 text-xs font-bold text-muted-foreground">
                          {formatKlyxProviderJobsDuration(locale, item.totalDurationMinutes)} {t("totalSuffix")}
                        </p>
                      )}
                  </div>
                </div>

                {item.requestMode === "multi_slot" ? (
                  <section className="mt-6 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 shrink-0 text-violet-600" size={20} />
                      <div>
                        <p className="font-black">{t("fullMissionCoverage")}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {t("fullMissionCoverageDetail")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {item.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="rounded-2xl border border-border bg-background p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-600">
                                {t("slot")} {slot.position}
                              </p>
                              <p className="mt-1 font-black">
                                {formatKlyxProviderJobsDate(locale, slot.date)}
                              </p>
                            </div>
                            {slot.budgetMax !== null && (
                              <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                                {money(slot.budgetMax, item.currency)}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <MiniInfo
                              icon={<Clock3 size={15} />}
                              label={t("schedule")}
                              value={`${timeLabel(slot.startTime)} - ${timeLabel(slot.endTime)}`}
                            />
                            <MiniInfo
                              icon={<CalendarDays size={15} />}
                              label={t("duration")}
                              value={formatKlyxProviderJobsDuration(locale, slot.durationMinutes)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {item.requested_date && (
                      <MiniInfo
                        icon={<CalendarDays size={15} />}
                        label={t("date")}
                        value={formatKlyxProviderJobsDate(locale, item.requested_date)}
                      />
                    )}
                    {item.requested_time && (
                      <MiniInfo
                        icon={<Clock3 size={15} />}
                        label={t("time")}
                        value={timeLabel(item.requested_time)}
                      />
                    )}
                  </div>
                )}

                {/* KLYX_JOB_TO_PROVIDER_ASSISTANT_13_78 */}
                <section className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles size={17} className="text-blue-600" />
                        <p className="font-black">{t("needHelp")}</p>
                      </div>
                    </div>
                    <a
                      href={
                        "/provider/assistant?prompt=" +
                        encodeURIComponent(
                          `Prépare une réponse professionnelle pour cette mission KLYX.\nMission : ${item.title}\nService : ${item.service?.name ?? "Service KLYX"}\nVille : ${item.city}\nBudget client : ${money(
                            item.requestMode === "multi_slot"
                              ? item.budgetTotal
                              : item.budget_max,
                            item.currency
                          )}\nDescription : ${item.description}\nCompatibilité KLYX : ${item.match?.score ?? 0}%.\nJe veux relire et modifier le brouillon avant toute action.`
                        )
                      }
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                    >
                      <Sparkles size={16} />
                      {t("prepareWithKlyx")}
                    </a>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {t("assistantControlNote")}
                  </p>
                </section>

                <form
                  onSubmit={(event) => void submitOffer(event, item)}
                  className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-[200px_1fr_auto]"
                >
                  <label>
                    <span className="mb-2 flex items-center gap-2 text-sm font-black">
                      <Banknote size={16} />
                      {item.requestMode === "multi_slot" ? t("totalPrice") : t("yourPrice")}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="klyx-input"
                      value={amounts[item.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-black">
                      {t("clientMessage")}
                    </span>
                    <input
                      className="klyx-input"
                      maxLength={1500}
                      value={messages[item.id] ?? ""}
                      onChange={(event) =>
                        setMessages((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder={
                        item.requestMode === "multi_slot"
                          ? t("multiMessagePlaceholder")
                          : t("singleMessagePlaceholder")
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      busy === item.id ||
                      (item.requestMode === "multi_slot" && !item.coverage?.fullCoverage)
                    }
                    className="klyx-button self-end disabled:opacity-50"
                  >
                    {busy === item.id ? (
                      <LoaderCircle className="animate-spin" size={17} />
                    ) : (
                      <Send size={17} />
                    )}
                    {item.myOffer
                      ? t("updateOffer")
                      : item.requestMode === "multi_slot"
                        ? t("proposeAll")
                        : t("sendOffer")}
                  </button>
                </form>

                {item.myOffer && (
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                    {t("currentOffer")}: {translateKlyxProviderJobOfferStatus(locale, item.myOffer.status)} · {money(Number(item.myOffer.amount), item.currency)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-border bg-card px-4 py-2 text-sm">
      <span className="font-black">{value}</span>
      <span className="ml-2 text-muted-foreground">{label}</span>
    </div>
  );
}

function TrackingCard({
  className,
  labelClassName,
  label,
  value,
  detail,
}: {
  className: string;
  labelClassName: string;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${labelClassName}`}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MiniInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
